import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from datetime import datetime, timezone, timedelta
from app.utils.auth import hash_password

client = TestClient(app)


def test_login_success_resets_lockout():
    """Successful login should reset failed attempts and lockout timers."""
    hashed = hash_password("SecureP@ss123")
    mock_user = {
        "_id": "user_123",
        "name": "Test User",
        "email": "test@example.com",
        "password": hashed,
        "role": "customer",
        "failed_login_attempts": 3,
        "lockout_until": datetime.now(timezone.utc) - timedelta(minutes=10)  # expired lockout
    }

    mock_db = MagicMock()
    mock_db.users_col = MagicMock()
    mock_db.users_col.find_one = AsyncMock(return_value=mock_user)
    mock_db.users_col.update_one = AsyncMock()

    with patch("app.routes.auth.get_db", return_value=mock_db):
        response = client.post("/auth/login", data={"username": "test@example.com", "password": "SecureP@ss123"})
        assert response.status_code == 200
        
        # Check that update_one was called to reset lockout fields
        mock_db.users_col.update_one.assert_called_once()
        args, kwargs = mock_db.users_col.update_one.call_args
        assert args[0] == {"_id": "user_123"}
        assert "$set" in args[1]
        assert args[1]["$set"] == {"failed_login_attempts": 0, "lockout_until": None}


def test_login_failure_increments_attempts():
    """Failed login should increment attempts in the database."""
    hashed = hash_password("SecureP@ss123")
    mock_user = {
        "_id": "user_123",
        "name": "Test User",
        "email": "test@example.com",
        "password": hashed,
        "role": "customer",
        "failed_login_attempts": 2,
        "lockout_until": None
    }

    mock_db = MagicMock()
    mock_db.users_col = MagicMock()
    mock_db.users_col.find_one = AsyncMock(return_value=mock_user)
    mock_db.users_col.update_one = AsyncMock()

    with patch("app.routes.auth.get_db", return_value=mock_db):
        response = client.post("/auth/login", data={"username": "test@example.com", "password": "wrongpassword"})
        assert response.status_code == 401
        
        # Check that update_one was called to increment attempts
        mock_db.users_col.update_one.assert_called_once()
        args, kwargs = mock_db.users_col.update_one.call_args
        assert args[0] == {"_id": "user_123"}
        assert "$set" in args[1]
        assert args[1]["$set"]["failed_login_attempts"] == 3


def test_login_lockout_triggered_after_5_failures():
    """Lockout should trigger and set lockout_until after 5 failures."""
    hashed = hash_password("SecureP@ss123")
    mock_user = {
        "_id": "user_123",
        "name": "Test User",
        "email": "test@example.com",
        "password": hashed,
        "role": "customer",
        "failed_login_attempts": 4,
        "lockout_until": None
    }

    mock_db = MagicMock()
    mock_db.users_col = MagicMock()
    mock_db.users_col.find_one = AsyncMock(return_value=mock_user)
    mock_db.users_col.update_one = AsyncMock()

    with patch("app.routes.auth.get_db", return_value=mock_db):
        response = client.post("/auth/login", data={"username": "test@example.com", "password": "wrongpassword"})
        assert response.status_code == 403
        assert "temporarily locked" in response.json()["detail"]
        
        # Check that update_one was called to set lockout_until
        mock_db.users_col.update_one.assert_called_once()
        args, kwargs = mock_db.users_col.update_one.call_args
        assert args[1]["$set"]["failed_login_attempts"] == 5
        assert isinstance(args[1]["$set"]["lockout_until"], datetime)


def test_login_locked_account_blocked():
    """Attempting to log in to a locked account should fail immediately."""
    hashed = hash_password("SecureP@ss123")
    mock_user = {
        "_id": "user_123",
        "name": "Test User",
        "email": "test@example.com",
        "password": hashed,
        "role": "customer",
        "failed_login_attempts": 5,
        "lockout_until": datetime.now(timezone.utc) + timedelta(minutes=15)
    }

    mock_db = MagicMock()
    mock_db.users_col = MagicMock()
    mock_db.users_col.find_one = AsyncMock(return_value=mock_user)
    mock_db.users_col.update_one = AsyncMock()

    with patch("app.routes.auth.get_db", return_value=mock_db):
        # Even with the CORRECT password, it should reject immediately
        response = client.post("/auth/login", data={"username": "test@example.com", "password": "SecureP@ss123"})
        assert response.status_code == 403
        assert "temporarily locked" in response.json()["detail"]
        mock_db.users_col.update_one.assert_not_called()
