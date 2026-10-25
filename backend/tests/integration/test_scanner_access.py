from datetime import datetime

import pytest


@pytest.fixture
def scanner_context(db_session, user_factory):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    manager = user_factory("manager", "Manager", Roles.manager)
    usher = user_factory("usher", "Usher", Roles.usher, boss_id=manager.id)
    event = Event.new(manager, "Assigned event", datetime(2026, 10, 11, 18, 0))
    usher.add_access(event.id, manager)
    ticket_type, _ = TicketType.add(manager, event, "Standard", 100, datetime(2026, 10, 1, 12, 0))
    db_session.commit()
    ticket, error = Ticket.new(manager, ticket_type, event, "Visitor", "", "", "SCANNER-ACCESS")
    assert error is None
    return manager, usher, event, ticket_type, ticket


@pytest.mark.parametrize("role", ["admin", "manager", "clerk", "usher"])
def test_all_roles_can_scan_only_assigned_events(
    scanner_context, client, login, user_factory, admin, role
):
    from data._roles import Roles

    manager, _, event, _, ticket = scanner_context
    if role == "admin":
        user = admin
        login("admin", "admin")
    else:
        user = user_factory("scanner", "Scanner", getattr(Roles, role))
        login("scanner")

    assert client.get(f"/api/scanner_events/{event.id}").status_code == 403
    denied = client.post("/api/check_ticket", json={"eventId": event.id, "code": ticket.code})
    assert denied.status_code == 403
    assert client.get("/api/events").get_json() == []

    user.add_access(event.id, manager)
    events = client.get("/api/events")
    assert [item["id"] for item in events.get_json()] == [event.id]
    assert client.get(f"/api/scanner_events/{event.id}").status_code == 200
    result = client.post("/api/check_ticket", json={"eventId": event.id, "code": ticket.code})
    assert result.status_code == 200
    assert result.get_json()["success"] is True
    assert result.get_json()["ticket"]["scannedById"] == user.id


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/api/events", None),
        ("GET", "/api/scanner_events/1", None),
        ("POST", "/api/check_ticket", {"eventId": 1, "code": "CODE"}),
    ],
)
def test_authenticated_user_without_scan_permission_is_rejected(
    client, login, user_factory, db_session, method, path, body
):
    from bafser import UserRole
    from data._roles import Roles

    user = user_factory("unprivileged", "Unprivileged", Roles.clerk)
    db_session.query(UserRole).filter_by(userId=user.id).delete()
    db_session.commit()
    login("unprivileged")
    response = client.open(path, method=method, json=body)
    assert response.status_code == 403
    assert response.get_json() == {"msg": "No permission"}


@pytest.mark.parametrize("role", ["admin", "manager", "clerk", "usher"])
def test_event_list_filters_inactive_events_without_page_permission(
    scanner_context, client, login, user_factory, db_session, role
):
    from data._roles import Roles
    from data.event import Event

    manager, _, active, _, _ = scanner_context
    inactive = Event.new(manager, "Inactive", datetime(2026, 10, 12, 18, 0))
    inactive.active = False
    deleted = Event.new(manager, "Deleted", datetime(2026, 10, 13, 18, 0))
    reader = user_factory("reader", "Reader", getattr(Roles, role))
    for event in (active, inactive, deleted):
        reader.add_access(event.id, manager)
    deleted.delete(manager)
    # This active event is not assigned to the reader.
    Event.new(manager, "Unassigned", datetime(2026, 10, 14, 18, 0))
    login("reader")

    response = client.get("/api/events")
    assert response.status_code == 200
    expected_ids = {active.id} if role == "usher" else {active.id, inactive.id}
    assert {item["id"] for item in response.get_json()} == expected_ids
    fields = {"id", "name", "date", "active"} | ({"ticketCount"} if role != "usher" else set())
    assert all(set(item) == fields for item in response.get_json())
    assert next(item for item in response.get_json() if item["id"] == active.id)["active"] is True
    if role != "usher":
        assert next(item for item in response.get_json() if item["id"] == active.id)["ticketCount"] == 1


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/api/events/{event_id}", None),
        ("GET", "/api/events/{event_id}/tickets", None),
        ("GET", "/api/events/{event_id}/tickets_stats", None),
        ("GET", "/api/events/{event_id}/ticket_types", None),
        ("GET", "/api/events/{event_id}/staff", None),
        ("POST", "/api/events", {}),
        ("POST", "/api/events/{event_id}", {}),
        ("DELETE", "/api/events/{event_id}", None),
        ("POST", "/api/events/{event_id}/staff", []),
        ("POST", "/api/events/{event_id}/ticket_types", []),
        ("POST", "/api/tickets", {}),
        ("POST", "/api/tickets/{ticket_id}", {}),
        ("DELETE", "/api/tickets/{ticket_id}", None),
        ("GET", "/api/staff", None),
        ("POST", "/api/staff", {}),
        ("GET", "/api/managers", None),
        ("GET", "/api/users", None),
        ("GET", "/api/events_full", None),
        ("GET", "/api/debug/log", None),
    ],
)
def test_usher_cannot_use_management_api(scanner_context, login, method, path, body):
    _, _, event, _, ticket = scanner_context
    client = login("usher")
    response = client.open(path.format(event_id=event.id, ticket_id=ticket.id), method=method, json=body)
    assert response.status_code == 403


def test_revoked_assignment_blocks_existing_session(scanner_context, login, db_session):
    _, usher, event, _, ticket = scanner_context
    client = login("usher")
    assert client.get(f"/api/scanner_events/{event.id}").status_code == 200

    manager_client = client.application.test_client()
    assert manager_client.post("/api/auth", json={"login": "manager", "password": "password"}).status_code == 200
    assert manager_client.post(f"/api/events/{event.id}/staff", json=[]).status_code == 200
    assert client.get("/api/events").get_json() == []
    assert client.get(f"/api/scanner_events/{event.id}").status_code == 403
    assert client.post("/api/check_ticket", json={"eventId": event.id, "code": ticket.code}).status_code == 403
    db_session.rollback()
    assert not ticket.scanned
    assert not usher.has_access(event.id)


def test_foreign_ticket_details_are_hidden(scanner_context, login, db_session, user_factory):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    _, _, event, _, _ = scanner_context
    foreign_manager = user_factory("foreign", "Foreign", Roles.manager)
    foreign_event = Event.new(foreign_manager, "Secret event", datetime(2026, 10, 12, 18, 0))
    foreign_type, _ = TicketType.add(foreign_manager, foreign_event, "Secret type", 100, datetime(2026, 10, 1, 12, 0))
    db_session.commit()
    ticket, _ = Ticket.new(foreign_manager, foreign_type, foreign_event, "Secret visitor", "", "", "SECRET-CODE")
    client = login("usher")
    response = client.post("/api/check_ticket", json={"eventId": event.id, "code": ticket.code})
    missing = client.post("/api/check_ticket", json={"eventId": event.id, "code": "MISSING"})
    assert response.status_code == 200
    assert response.get_json() == missing.get_json() == {
        "success": False, "errorCode": "notExist", "ticket": None, "event": None,
    }
    db_session.rollback()
    assert not ticket.scanned


def test_usher_repeated_scan_keeps_original_actor_time_and_log(scanner_context, login, db_session):
    from bafser import Log

    _, usher, event, _, ticket = scanner_context
    client = login("usher")
    request = {"eventId": event.id, "code": ticket.code}
    first = client.post("/api/check_ticket", json=request).get_json()
    repeated = client.post("/api/check_ticket", json=request).get_json()
    assert first["success"] is True
    assert first["ticket"]["scannedById"] == usher.id
    assert repeated["errorCode"] == "scanned"
    assert repeated["ticket"] == first["ticket"]
    db_session.rollback()
    logs = db_session.query(Log).filter_by(tableName="Ticket", recordId=ticket.id, actionCode="updated").all()
    assert len(logs) == 1
    assert logs[0].userId == usher.id


@pytest.mark.parametrize("role", ["manager", "clerk"])
def test_ticket_rendering_assets_remain_available_to_ticket_staff(client, login, user_factory, role):
    from data._roles import Roles

    user_factory("staff", "Staff", getattr(Roles, role))
    login("staff")
    assert client.get("/api/fonts").status_code == 200
    assert client.get("/api/fonts/999999").status_code == 404
    assert client.get("/api/img/999999").status_code == 404


@pytest.mark.parametrize("state", ["inactive", "deleted"])
def test_unavailable_assignments_are_not_listed_or_scannable(scanner_context, login, db_session, state):
    manager, _, event, _, ticket = scanner_context
    if state == "inactive":
        event.active = False
        db_session.commit()
    else:
        event.delete(manager)
    client = login("usher")
    assert client.get("/api/events").get_json() == []
    assert client.get(f"/api/scanner_events/{event.id}").status_code != 200
    response = client.post("/api/check_ticket", json={"eventId": event.id, "code": ticket.code})
    assert response.status_code == 403
    db_session.rollback()
    assert not ticket.scanned


def test_manager_can_disable_and_reenable_scanning_without_resetting_checkin(scanner_context, login):
    _, _, event, _, ticket = scanner_context
    event_url = f"/api/events/{event.id}"
    scanner_url = f"/api/scanner_events/{event.id}"
    request = {"eventId": event.id, "code": ticket.code}
    client = login("usher")
    first = client.post("/api/check_ticket", json=request).get_json()
    assert first["success"] is True
    payload = {"name": event.name, "date": "2026-10-11T18:00:00Z", "active": False}
    assert client.post(event_url, json=payload).status_code == 403

    login("manager")
    disabled = client.post(event_url, json=payload)
    assert disabled.status_code == 200
    assert disabled.get_json()["active"] is False
    login("usher")
    assert client.get("/api/events").get_json() == []
    assert client.get(scanner_url).status_code == 403
    assert client.post("/api/check_ticket", json=request).status_code == 403

    login("manager")
    enabled = client.post(event_url, json={**payload, "active": True})
    assert enabled.status_code == 200
    assert enabled.get_json()["active"] is True
    login("usher")
    assert [item["id"] for item in client.get("/api/events").get_json()] == [event.id]
    assert client.get(scanner_url).status_code == 200
    repeated = client.post("/api/check_ticket", json=request).get_json()
    assert repeated["errorCode"] == "scanned"
    assert repeated["ticket"] == first["ticket"]


def test_manager_creates_and_assigns_an_usher(client, login, user_factory, db_session):
    from data._roles import Roles
    from data.event import Event
    from data.user import User

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "Event", datetime(2026, 10, 11, 18, 0))
    login("manager")
    created = client.post("/api/staff", json={"name": "Usher", "login": "usher", "role": "usher"})
    assert created.status_code == 200
    data = created.get_json()
    assert data["roles"] == ["Билетёр"]
    assert data["operations"] == ["scan_tickets"]
    assert User.get(data["id"], db_sess=db_session).bossId == manager.id
    assert client.get("/api/staff").get_json()[0]["id"] == data["id"]
    assigned = client.post(f"/api/events/{event.id}/staff", json=[data["id"]])
    assert assigned.status_code == 200
    assert assigned.get_json()[0]["roles"] == ["Билетёр"]
    login("usher", data["password"])
    assert client.get(f"/api/scanner_events/{event.id}").status_code == 200
    assert client.get("/api/events").status_code == 200


@pytest.mark.parametrize("role", ["admin", "manager", "owner", "unknown", 1, True, None, [], {}])
def test_staff_creation_cannot_assign_privileged_or_invalid_roles(client, login, user_factory, role):
    from data._roles import Roles

    user_factory("manager", "Manager", Roles.manager)
    login("manager")
    response = client.post("/api/staff", json={"name": "Staff", "login": "staff", "role": role})
    assert response.status_code == 400
    assert client.get("/api/staff").get_json() == []
