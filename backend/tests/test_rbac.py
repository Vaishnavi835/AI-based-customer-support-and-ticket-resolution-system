import pytest
from fastapi import HTTPException
from app.utils.roles import Role, has_permission, get_permissions



def test_admin_has_manage_all():
    assert has_permission(Role.admin, "manage:all") is True


def test_admin_can_delete_ticket():
    assert has_permission(Role.admin, "delete:ticket") is True


def test_admin_can_delete_user():
    assert has_permission(Role.admin, "delete:user") is True


def test_support_agent_cannot_delete_ticket():
    assert has_permission(Role.support_agent, "delete:ticket") is False


def test_support_agent_cannot_delete_user():
    assert has_permission(Role.support_agent, "delete:user") is False


def test_support_agent_can_update_ticket():
    assert has_permission(Role.support_agent, "update:ticket") is True


def test_customer_cannot_update_ticket():
    assert has_permission(Role.customer, "update:ticket") is False


def test_customer_cannot_delete_ticket():
    assert has_permission(Role.customer, "delete:ticket") is False


def test_customer_can_create_ticket():
    assert has_permission(Role.customer, "create:ticket") is True


def test_customer_can_read_ticket():
    assert has_permission(Role.customer, "read:ticket") is True


def test_invalid_role_returns_empty_permissions():
    assert get_permissions("unknown_role") == []


def test_all_roles_have_create_ticket():
    for role in Role:
        assert has_permission(role, "create:ticket") is True


def test_only_admin_has_manage_all():
    assert has_permission(Role.admin,         "manage:all") is True
    assert has_permission(Role.support_agent, "manage:all") is False
    assert has_permission(Role.customer,      "manage:all") is False