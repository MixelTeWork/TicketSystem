import pytest


PROTECTED_ROUTES = [
    ("GET", "/api/user", None),
    ("GET", "/api/users", None),
    ("POST", "/api/user/change_name", {"name": "Name"}),
    ("POST", "/api/user/change_password", {"password": "password"}),
    ("GET", "/api/events", None),
    ("POST", "/api/events", {"name": "Event", "date": "2026-09-26T12:00:00"}),
    ("GET", "/api/events/1", None),
    ("POST", "/api/events/1", {"name": "Event", "date": "2026-09-26T12:00:00"}),
    ("DELETE", "/api/events/1", None),
    ("GET", "/api/events_full", None),
    ("POST", "/api/events/1/add_access", None),
    ("GET", "/api/events/1/ticket_types", None),
    ("POST", "/api/events/1/ticket_types", []),
    ("GET", "/api/ticket_types/1", None),
    ("POST", "/api/ticket_types/1", {"img": None, "pattern": {}}),
    ("GET", "/api/events/1/tickets", None),
    ("POST", "/api/tickets", {}),
    ("POST", "/api/tickets/1", {}),
    ("DELETE", "/api/tickets/1", None),
    ("GET", "/api/events/1/tickets_stats", None),
    ("GET", "/api/staff", None),
    ("POST", "/api/staff", {}),
    ("DELETE", "/api/staff/1", None),
    ("POST", "/api/staff/1/reset_password", None),
    ("GET", "/api/events/1/staff", None),
    ("POST", "/api/events/1/staff", []),
    ("GET", "/api/managers", None),
    ("POST", "/api/managers", {}),
    ("DELETE", "/api/managers/1", None),
    ("GET", "/api/fonts", None),
    ("POST", "/api/fonts", None),
    ("GET", "/api/fonts/1", None),
    ("GET", "/api/img/1", None),
    ("POST", "/api/img", {}),
    ("GET", "/api/debug/log", None),
    ("GET", "/api/debug/log_len", None),
]


@pytest.mark.parametrize("method,path,body", PROTECTED_ROUTES)
def test_protected_routes_reject_anonymous_clients(client, method, path, body):
    response = client.open(path, method=method, json=body)

    assert response.status_code == 401
    assert response.get_json() == {"msg": "Unauthorized"}


@pytest.mark.parametrize(
    "role,login_name,allowed_path,forbidden_path",
    [
        ("manager", "manager", "/api/events", "/api/managers"),
        ("clerk", "clerk", "/api/events", "/api/staff"),
        ("owner", "owner", "/api/managers", "/api/events"),
    ],
)
def test_role_boundaries(
    client, login, user_factory, role, login_name, allowed_path, forbidden_path
):
    from data._roles import Roles

    user_factory(login_name, login_name.title(), getattr(Roles, role))
    login(login_name)

    assert client.get(allowed_path).status_code == 200
    forbidden = client.get(forbidden_path)
    assert forbidden.status_code == 403
    assert forbidden.get_json() == {"msg": "No permission"}

