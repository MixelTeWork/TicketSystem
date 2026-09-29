import pytest


def assert_message(response, status, message):
    assert response.status_code == status
    assert response.get_json() == {"msg": message}


@pytest.mark.contract
def test_login_rejects_wrong_credentials(client):
    response = client.post("/api/auth", json={"login": "admin", "password": "wrong"})

    assert_message(response, 400, "Неправильный логин или пароль")


@pytest.mark.contract
def test_login_returns_user_contract_and_sets_cookie(client):
    response = client.post("/api/auth", json={"login": "admin", "password": "admin"})

    assert response.status_code == 200
    assert set(response.get_json()) == {"id", "login", "name", "roles", "operations"}
    assert response.get_json()["login"] == "admin"
    assert "access_token_cookie=" in response.headers["Set-Cookie"]


@pytest.mark.contract
def test_current_user_requires_authentication(client):
    assert_message(client.get("/api/user"), 401, "Unauthorized")


@pytest.mark.contract
def test_authenticated_current_user_has_same_shape(logged_in_admin):
    response = logged_in_admin.get("/api/user")

    assert response.status_code == 200
    assert set(response.get_json()) == {"id", "login", "name", "roles", "operations"}
    assert response.get_json()["login"] == "admin"


@pytest.mark.contract
def test_logout_clears_authentication_cookie(logged_in_admin):
    response = logged_in_admin.post("/api/logout")

    assert response.status_code == 200
    assert response.get_json() == {"msg": "logout successful"}
    assert "access_token_cookie=;" in response.headers["Set-Cookie"]
    assert_message(logged_in_admin.get("/api/user"), 401, "Unauthorized")


@pytest.mark.contract
def test_json_content_type_is_required(client):
    assert_message(client.post("/api/auth", data="{}"), 415, "body is not json")
