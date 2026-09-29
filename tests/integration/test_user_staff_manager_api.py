from datetime import datetime

import pytest


def test_change_name_and_password_invalidates_existing_token(logged_in_admin):
    renamed = logged_in_admin.post(
        "/api/user/change_name", json={"name": "Renamed admin"}
    )
    changed = logged_in_admin.post(
        "/api/user/change_password", json={"password": "new-password"}
    )
    stale_token = logged_in_admin.get("/api/user")

    assert renamed.get_json() == {"msg": "ok"}
    assert changed.get_json() == {"msg": "ok"}
    assert stale_token.status_code == 401
    assert stale_token.get_json() == {"msg": "The JWT has expired"}


@pytest.fixture
def manager_and_event(db_session, user_factory, login):
    from data._roles import Roles
    from data.event import Event

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "Staff event", datetime(2026, 9, 26, 12, 0))
    db_session.commit()
    return login("manager"), manager, event


def test_staff_full_lifecycle(manager_and_event):
    client, _, event = manager_and_event

    created = client.post(
        "/api/staff", json={"name": "Clerk", "login": "clerk"}
    )
    staff_id = created.get_json()["id"]
    assigned = client.post(
        "/api/events/{}/staff".format(event.id), json=[staff_id]
    )
    reset = client.post("/api/staff/{}/reset_password".format(staff_id))
    removed = client.post("/api/events/{}/staff".format(event.id), json=[])
    deleted = client.delete("/api/staff/{}".format(staff_id))

    assert created.status_code == 200
    assert set(created.get_json()) == {
        "id", "login", "name", "roles", "operations", "password"
    }
    assert len(created.get_json()["password"]) == 8
    assert [user["id"] for user in assigned.get_json()] == [staff_id]
    assert len(reset.get_json()["password"]) == 8
    assert reset.get_json()["password"] != created.get_json()["password"]
    assert removed.get_json() == []
    assert deleted.get_json() == {"msg": "ok"}


def test_manager_cannot_modify_another_managers_staff(
    manager_and_event, user_factory
):
    client, manager, _ = manager_and_event
    from data._roles import Roles

    other_manager = user_factory("other-manager", "Other", Roles.manager)
    other_staff = user_factory(
        "other-clerk", "Other clerk", Roles.clerk, boss_id=other_manager.id
    )

    delete_response = client.delete("/api/staff/{}".format(other_staff.id))
    reset_response = client.post(
        "/api/staff/{}/reset_password".format(other_staff.id)
    )

    assert manager.id != other_manager.id
    assert delete_response.status_code == 403
    assert reset_response.status_code == 403


def test_duplicate_staff_login_is_rejected(manager_and_event, user_factory):
    client, manager, _ = manager_and_event
    from data._roles import Roles

    existing = user_factory("taken", "Existing", Roles.clerk, boss_id=manager.id)
    existing.delete(manager)

    response = client.post(
        "/api/staff", json={"name": "Replacement", "login": "taken"}
    )

    assert response.status_code == 400
    assert response.get_json() == {"msg": "User with login 'taken' already exist"}


def test_owner_can_create_list_and_delete_manager(client, login, user_factory):
    from data._roles import Roles

    user_factory("owner", "Owner", Roles.owner)
    login("owner")

    created = client.post(
        "/api/managers", json={"name": "Manager", "login": "manager"}
    )
    manager_id = created.get_json()["id"]
    listed = client.get("/api/managers")
    deleted = client.delete("/api/managers/{}".format(manager_id))

    assert created.status_code == 200
    assert len(created.get_json()["password"]) == 8
    assert [user["id"] for user in listed.get_json()] == [manager_id]
    assert deleted.get_json() == {"msg": "ok"}


def test_staff_list_and_missing_member_errors(manager_and_event):
    client, _, event = manager_and_event

    assert client.get("/api/staff").get_json() == []
    assert client.get("/api/events/{}/staff".format(event.id)).get_json() == []
    missing_delete = client.delete("/api/staff/999999")
    missing_reset = client.post("/api/staff/999999/reset_password")

    assert missing_delete.status_code == 400
    assert "not found" in missing_delete.get_json()["msg"]
    assert missing_reset.status_code == 400
    assert "not found" in missing_reset.get_json()["msg"]


def test_manager_duplicate_login_and_missing_delete(client, login, user_factory):
    from data._roles import Roles

    user_factory("owner", "Owner", Roles.owner)
    existing = user_factory("taken", "Existing", Roles.manager)
    existing.delete(existing)
    login("owner")

    duplicate = client.post(
        "/api/managers", json={"name": "Replacement", "login": "taken"}
    )
    missing = client.delete("/api/managers/999999")

    assert duplicate.status_code == 400
    assert "already exist" in duplicate.get_json()["msg"]
    assert missing.status_code == 400
    assert "not found" in missing.get_json()["msg"]


def test_manager_requires_login(client, login, user_factory):
    from data._roles import Roles

    user_factory("owner", "Owner", Roles.owner)
    login("owner")

    response = client.post("/api/managers", json={"name": "No login"})

    assert response.status_code == 400
    assert "login" in response.get_json()["msg"]


def test_admin_users_endpoint_returns_full_records(logged_in_admin):
    response = logged_in_admin.get("/api/users")

    assert response.status_code == 200
    assert len(response.get_json()) == 1
    assert set(response.get_json()[0]) == {
        "id", "name", "login", "roles", "bossId", "deleted", "access", "operations"
    }
