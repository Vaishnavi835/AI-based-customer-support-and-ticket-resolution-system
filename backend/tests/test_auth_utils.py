import pytest
from fastapi import HTTPException

from app.utils.auth import hash_password, verify_password
from app.utils.jwt import create_access_token, verify_access_token


def test_hash_password_returns_non_plain_string():
    password = "test123"

    hashed = hash_password(password)

    assert isinstance(hashed, str)
    assert hashed != password


def test_verify_password_accepts_correct_password():
    password = "test123"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("test123")

    assert verify_password("wrongpassword", hashed) is False


def test_create_access_token_returns_string():
    token = create_access_token({"sub": "user_123", "email": "test@test.com"})

    assert isinstance(token, str)
    assert token


def test_verify_access_token_decodes_valid_token():
    token = create_access_token({"sub": "user_123", "email": "test@test.com"})

    payload = verify_access_token(token)

    assert payload["sub"] == "user_123"
    assert payload["email"] == "test@test.com"


def test_verify_access_token_rejects_invalid_token():
    with pytest.raises(HTTPException) as exc_info:
        verify_access_token("this.is.fake")

    assert exc_info.value.status_code == 401
