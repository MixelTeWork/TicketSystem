from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from flask.testing import FlaskClient
    from werkzeug.test import TestResponse


def assert_message(response: TestResponse, status: int, message: str):
    assert response.status_code == status
    assert response.get_json() == {"msg": message}


@pytest.mark.contract
def test_login_rejects_wrong_credentials(client: FlaskClient):
    response = client.post("/api/auth", json={"login": "admin", "password": "wrong"})

    assert_message(response, 400, "Неправильный логин или пароль")


@pytest.mark.contract
def test_login_returns_user_contract_and_sets_cookie(client: FlaskClient):
    response = client.post("/api/auth", json={"login": "admin", "password": "admin"})

    assert response.status_code == 200
    assert set(response.get_json()) == {"id", "login", "name", "roles", "operations"}
    assert response.get_json()["login"] == "admin"
    assert response.get_json()["roles"]
    assert all(isinstance(role, str) for role in response.get_json()["roles"])
    assert "access_token_cookie=" in response.headers["Set-Cookie"]


@pytest.mark.contract
def test_current_user_requires_authentication(client: FlaskClient):
    assert_message(client.get("/api/user"), 401, "Unauthorized")


@pytest.mark.contract
def test_authenticated_current_user_has_same_shape(logged_in_admin: FlaskClient):
    response = logged_in_admin.get("/api/user")

    assert response.status_code == 200
    assert set(response.get_json()) == {"id", "login", "name", "roles", "operations"}
    assert response.get_json()["login"] == "admin"


@pytest.mark.contract
def test_full_users_keep_role_ids_and_names(logged_in_admin: FlaskClient):
    response = logged_in_admin.get("/api/users")

    assert response.status_code == 200
    users = response.get_json()
    admin = next(user for user in users if user["login"] == "admin")
    assert admin["roles"]
    assert all(
        len(role) == 2 and isinstance(role[0], int) and isinstance(role[1], str)
        for role in admin["roles"]
    )


@pytest.mark.contract
def test_logout_clears_authentication_cookie(logged_in_admin: FlaskClient):
    response = logged_in_admin.post("/api/logout")

    assert response.status_code == 200
    assert response.get_json() == {"msg": "logout successful"}
    assert "access_token_cookie=;" in response.headers["Set-Cookie"]
    assert_message(logged_in_admin.get("/api/user"), 401, "Unauthorized")


@pytest.mark.contract
def test_json_content_type_is_required(client: FlaskClient):
    assert_message(client.post("/api/auth", data="{}"), 415, "body is not json")
