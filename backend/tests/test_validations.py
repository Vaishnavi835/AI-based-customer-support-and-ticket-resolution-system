import pytest
from app.schemas.auth import RegisterRequest
from app.schemas.user import UserCreate
from pydantic import ValidationError


# ── Registration Validation Tests ─────────────────────────────────────────────

def test_register_valid_data():
    """Valid registration data should pass."""
    data = RegisterRequest(name="John", email="john@test.com", password="SecureP@ss123")
    assert data.name == "John"
    assert data.email == "john@test.com"


def test_register_invalid_email():
    """Invalid email format should fail."""
    with pytest.raises(ValidationError):
        RegisterRequest(name="John", email="not-an-email", password="SecureP@ss123")


def test_register_short_password():
    """Password shorter than 8 chars should fail."""
    with pytest.raises(ValidationError):
        RegisterRequest(name="John", email="john@test.com", password="P@ss1")


def test_register_empty_name():
    """Empty name should fail."""
    with pytest.raises(ValidationError):
        RegisterRequest(name="", email="john@test.com", password="SecureP@ss123")


def test_register_short_name():
    """Two-character name should fail since min_length is 3."""
    with pytest.raises(ValidationError):
        RegisterRequest(name="Jo", email="john@test.com", password="SecureP@ss123")


def test_register_email_lowercased():
    """Email should be automatically lowercased."""
    data = RegisterRequest(name="John", email="JOHN@TEST.COM", password="SecureP@ss123")
    assert data.email == "john@test.com"


def test_register_name_trimmed():
    """Name should be automatically trimmed."""
    data = RegisterRequest(name="  John  ", email="john@test.com", password="SecureP@ss123")
    assert data.name == "John"


# ── Password Complexity Validation Tests ──────────────────────────────────────

def test_register_password_no_uppercase():
    """Password with no uppercase should fail."""
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(name="John", email="john@test.com", password="securep@ss123")
    assert "at least one uppercase letter" in str(exc.value)


def test_register_password_no_lowercase():
    """Password with no lowercase should fail."""
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(name="John", email="john@test.com", password="SECUREP@SS123")
    assert "at least one lowercase letter" in str(exc.value)


def test_register_password_no_digit():
    """Password with no digit should fail."""
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(name="John", email="john@test.com", password="SecureP@ss")
    assert "at least one digit" in str(exc.value)


def test_register_password_no_special_char():
    """Password with no special character should fail."""
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(name="John", email="john@test.com", password="SecurePass123")
    assert "at least one special character" in str(exc.value)


# ── User Role Validation Tests ────────────────────────────────────────────────

def test_user_create_valid_role():
    """Valid role should pass."""
    user = UserCreate(name="Test Agent", email="agent@test.com", role="support_agent")
    assert user.role == "support_agent"


def test_user_create_invalid_role():
    """Invalid role should fail."""
    with pytest.raises(ValidationError):
        UserCreate(name="Test", email="test@test.com", role="superadmin")


def test_user_create_default_role():
    """Default role should be customer."""
    user = UserCreate(name="Test User", email="user@test.com")
    assert user.role == "customer"
