from datetime import datetime

import pytest


@pytest.fixture
def ticket_scenario(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Contract event", datetime(2026, 9, 26, 18, 30))
    ticket_type, _ = TicketType.add(admin, event, "Standard", 1500, datetime(2026, 9, 1, 12, 0))
    db_session.commit()
    ticket, error = Ticket.new(
        admin,
        ticket_type,
        event,
        "Test Person",
        "https://example.test/person",
        "PROMO",
        "CONTRACT-CODE",
        1200,
    )
    assert error is None
    db_session.commit()
    return event, ticket_type, ticket


@pytest.mark.contract
def test_api_index_visibility_and_docs(client):
    from bafser import get_api_docs

    response = client.get("/api")

    if client.application.config["TEST_DB_KIND"] == "mysql":
        assert response.status_code == 404
    else:
        assert response.status_code == 200
        assert response.content_type.startswith("text/html")
    docs = get_api_docs()
    assert docs["/api/auth POST"]["request"] == {"login": "string", "password": "string"}
    assert docs["/api/auth POST"]["__jwt__"] is False
    assert docs["/api/events GET"]["__permsions__"]
    batch_request = docs["/api/events/<int:eventId>/ticket_types POST"]["request"][0]
    assert {"name", "price?", "id?", "action"} <= set(batch_request)


@pytest.mark.contract
def test_unknown_api_route_contract(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.get_json() == {"msg": "Not found"}


@pytest.mark.contract
def test_scanner_event_response_shape(client, ticket_scenario):
    event, _, _ = ticket_scenario

    response = client.get("/api/scanner_events/{}".format(event.id))

    assert response.status_code == 200
    assert set(response.get_json()) == {"id", "name", "date"}
    assert response.get_json()["name"] == "Contract event"


@pytest.mark.contract
def test_missing_ticket_scan_contract(client, ticket_scenario):
    event, _, _ = ticket_scenario

    response = client.post(
        "/api/check_ticket",
        json={"code": "MISSING", "eventId": event.id},
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "success": False,
        "errorCode": "notExist",
        "ticket": None,
        "event": None,
    }


@pytest.mark.contract
def test_first_and_repeated_scan_contract(client, ticket_scenario, db_session):
    from bafser import Log

    event, _, ticket = ticket_scenario
    request = {"code": ticket.code, "eventId": event.id}

    first = client.post("/api/check_ticket", json=request)
    repeated = client.post("/api/check_ticket", json=request)

    assert first.status_code == 200
    assert first.get_json()["success"] is True
    assert first.get_json()["errorCode"] is None
    assert first.get_json()["event"] is None
    assert first.get_json()["ticket"]["scanned"] is True
    assert repeated.status_code == 200
    assert repeated.get_json()["success"] is False
    assert repeated.get_json()["errorCode"] == "scanned"
    assert repeated.get_json()["ticket"]["id"] == ticket.id
    db_session.rollback()
    scan_logs = db_session.query(Log).filter_by(
        tableName="Ticket", recordId=ticket.id, actionCode="updated"
    ).all()
    assert len(scan_logs) == 1
    assert {change[0] for change in scan_logs[0].changes} == {"scanned", "scannedDate"}


@pytest.mark.contract
@pytest.mark.parametrize("state", ["inactive", "deleted"])
def test_scan_rejects_unavailable_event(client, ticket_scenario, db_session, admin, state):
    event, _, ticket = ticket_scenario
    if state == "inactive":
        event.active = False
        db_session.commit()
    else:
        event.delete(admin)

    response = client.post(
        "/api/check_ticket", json={"code": ticket.code, "eventId": event.id}
    )

    db_session.rollback()
    assert response.status_code == 403
    assert response.get_json() == {"msg": "Event is not active"}
    assert not ticket.scanned


@pytest.mark.contract
@pytest.mark.parametrize("key", ["wrong", "неверный", "🔑", ""])
def test_platform_api_rejects_wrong_key(client, ticket_scenario, key):
    event, _, ticket = ticket_scenario

    response = client.get(
        "/api/v1/user_info_by_ticket",
        json={"apikey": key, "eventId": event.id, "code": ticket.code},
    )

    assert response.status_code == 403
    assert response.get_json() == {"msg": "No permission"}


@pytest.mark.contract
def test_full_event_access_contains_user_data(logged_in_admin, ticket_scenario, admin):
    from bafser import get_api_docs

    event, _, _ = ticket_scenario
    response = logged_in_admin.get("/api/events_full")

    assert response.status_code == 200
    data = next(item for item in response.get_json() if item["id"] == event.id)
    assert data["access"] == [admin.get_dict()]
    assert get_api_docs()["FullEventData"]["access"] == "UserData[]"


@pytest.mark.contract
def test_platform_api_success_contract(client, app, ticket_scenario, db_session):
    from bafser import Log

    event, ticket_type, ticket = ticket_scenario

    response = client.get(
        "/api/v1/user_info_by_ticket",
        json={
            "apikey": app.config["API_SECRET_KEY"],
            "eventId": event.id,
            "code": ticket.code,
        },
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "res": "ok",
        "data": {
            "typeId": ticket_type.id,
            "typeName": "Standard",
            "personName": "Test Person",
        },
    }
    repeated = client.get(
        "/api/v1/user_info_by_ticket",
        json={
            "apikey": app.config["API_SECRET_KEY"],
            "eventId": event.id,
            "code": ticket.code,
        },
    )
    assert repeated.get_json() == response.get_json()
    db_session.rollback()
    platform_logs = db_session.query(Log).filter_by(
        tableName="Ticket", recordId=ticket.id, actionCode="updated"
    ).all()
    assert len(platform_logs) == 1
    assert {change[0] for change in platform_logs[0].changes} == {"authOnPltf"}


@pytest.mark.contract
def test_platform_api_not_found_and_wrong_event_contract(
    client, app, ticket_scenario, db_session, admin
):
    from data.event import Event

    event, _, ticket = ticket_scenario
    other = Event.new(admin, "Other", datetime(2026, 10, 1, 12, 0))
    db_session.commit()
    common = {"apikey": app.config["API_SECRET_KEY"], "eventId": event.id}

    missing = client.get(
        "/api/v1/user_info_by_ticket", json={**common, "code": "MISSING"}
    )
    wrong = client.get(
        "/api/v1/user_info_by_ticket",
        json={**common, "eventId": other.id, "code": ticket.code},
    )

    assert missing.get_json() == {"res": "not found"}
    assert wrong.get_json() == {"res": "wrong event"}


@pytest.mark.contract
def test_inactive_scanner_event_is_forbidden(client, ticket_scenario, db_session):
    event, _, _ = ticket_scenario
    event.active = False
    db_session.commit()

    response = client.get("/api/scanner_events/{}".format(event.id))

    assert response.status_code == 403
    assert response.get_json() == {"msg": "Event is not active"}
