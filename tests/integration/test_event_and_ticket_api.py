from datetime import datetime
import base64

import pytest


@pytest.fixture
def manager_context(db_session, user_factory, login):
    from data._roles import Roles
    from data.event import Event
    from data.ticket_type import TicketType

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "API event", datetime(2026, 9, 26, 18, 0))
    ticket_type, _ = TicketType.add(
        manager, event, "Standard", 1000, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    client = login("manager")
    return client, manager, event, ticket_type


def test_event_create_update_and_delete_contract(manager_context):
    client, _, _, _ = manager_context

    created = client.post(
        "/api/events",
        json={"name": "New event", "date": "2027-01-02T15:30:00"},
    )
    event_id = created.get_json()["id"]
    updated = client.post(
        "/api/events/{}".format(event_id),
        json={"name": "Renamed", "date": "2027-01-03T16:45:00"},
    )
    deleted = client.delete("/api/events/{}".format(event_id))

    assert created.status_code == 200
    assert set(created.get_json()) == {"id", "name", "date"}
    assert updated.status_code == 200
    assert updated.get_json()["name"] == "Renamed"
    assert deleted.status_code == 200
    assert deleted.get_json() == {"msg": "ok"}
    missing = client.get("/api/events/{}".format(event_id))
    assert missing.status_code == 400
    assert missing.get_json() == {
        "msg": "Event with 'eventId={}' not found".format(event_id)
    }


@pytest.mark.parametrize("price", ["100", 1.5, True, [], {}])
def test_ticket_rejects_non_integer_price(manager_context, price):
    client, _, event, ticket_type = manager_context

    response = client.post(
        "/api/tickets",
        json={
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Person",
            "personLink": "",
            "promocode": "",
            "code": "PRICE-{}".format(type(price).__name__),
            "price": price,
        },
    )

    # `bool` is deliberately characterized: Python's exact-type check rejects it.
    assert response.status_code == 400
    assert response.get_json() == {"msg": "price is not int or None"}


def test_ticket_lifecycle_and_statistics(manager_context):
    client, _, event, ticket_type = manager_context
    payload = {
        "eventId": event.id,
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "https://example.test",
        "promocode": "PROMO",
        "code": "API-CODE",
        "price": 900,
    }

    created = client.post("/api/tickets", json=payload)
    ticket_id = created.get_json()["id"]
    listed = client.get("/api/events/{}/tickets".format(event.id))
    stats_before = client.get("/api/events/{}/tickets_stats".format(event.id))
    scanned = client.post(
        "/api/check_ticket", json={"eventId": event.id, "code": "API-CODE"}
    )
    stats_after = client.get("/api/events/{}/tickets_stats".format(event.id))
    deleted = client.delete("/api/tickets/{}".format(ticket_id))

    assert created.status_code == 200
    assert created.get_json()["price"] == 900
    assert [item["id"] for item in listed.get_json()] == [ticket_id]
    assert stats_before.get_json() == [
        {"typeId": ticket_type.id, "count": 1, "scanned": 0, "authOnPltf": 0}
    ]
    assert scanned.get_json()["success"] is True
    assert stats_after.get_json()[0]["scanned"] == 1
    assert deleted.get_json() == {"msg": "ok"}
    assert client.get("/api/events/{}/tickets".format(event.id)).get_json() == []


def test_ticket_update_contract(manager_context):
    client, _, event, ticket_type = manager_context
    created = client.post(
        "/api/tickets",
        json={
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Before",
            "personLink": "before",
            "promocode": "OLD",
            "code": "UPDATE-API",
            "price": None,
        },
    ).get_json()

    response = client.post(
        "/api/tickets/{}".format(created["id"]),
        json={
            "typeId": ticket_type.id,
            "personName": "After",
            "personLink": "after",
            "promocode": "NEW",
            "price": 123,
        },
    )

    assert response.status_code == 200
    assert response.get_json()["personName"] == "After"
    assert response.get_json()["price"] == 123


def test_ticket_type_list_batch_update_and_design(manager_context):
    client, _, event, original = manager_context

    listed = client.get("/api/events/{}/ticket_types".format(event.id))
    changed = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=[
            {
                "action": "update",
                "id": original.id,
                "name": "Renamed",
                "price": 1100,
            },
            {"action": "add", "name": "VIP", "price": 2500},
        ],
    )
    vip = next(item for item in changed.get_json() if item["name"] == "VIP")
    image = base64.b64encode(b"ticket-background").decode("ascii")
    designed = client.post(
        "/api/ticket_types/{}".format(vip["id"]),
        json={
            "pattern": {"width": 1280, "height": 720, "objects": []},
            "img": {
                "name": "background",
                "data": "data:image/png;base64," + image,
                "accessEventId": event.id,
            },
        },
    )
    replaced = client.post(
        "/api/ticket_types/{}".format(vip["id"]),
        json={
            "pattern": {"width": 640, "height": 360, "objects": []},
            "img": {
                "name": "replacement",
                "data": "data:image/png;base64," + image,
                "accessEventId": event.id,
            },
        },
    )
    fetched = client.get("/api/ticket_types/{}".format(vip["id"]))
    after_delete = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=[
            {
                "action": "delete",
                "id": vip["id"],
                "name": "VIP",
                "price": 2500,
            }
        ],
    )

    assert listed.get_json() == [original.get_dict()]
    assert designed.status_code == 200
    assert designed.get_json()["imageId"] is not None
    assert replaced.status_code == 200
    assert replaced.get_json()["imageId"] != designed.get_json()["imageId"]
    assert fetched.get_json() == replaced.get_json()
    assert [item["name"] for item in after_delete.get_json()] == ["Renamed"]


@pytest.mark.parametrize("date", ["not-a-date", 123, None])
def test_event_rejects_invalid_date(manager_context, date):
    client, _, _, _ = manager_context
    response = client.post("/api/events", json={"name": "Invalid", "date": date})
    assert response.status_code == 400
    assert response.get_json() == {"msg": "date is not datetime"}


def test_ticket_type_must_belong_to_ticket_event(
    manager_context, db_session
):
    client, manager, event, _ = manager_context
    from data.event import Event
    from data.ticket_type import TicketType

    other_event = Event.new(manager, "Other", datetime(2026, 10, 1, 12, 0))
    other_type, _ = TicketType.add(
        manager, other_event, "Other type", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()

    response = client.post(
        "/api/tickets",
        json={
            "eventId": event.id,
            "typeId": other_type.id,
            "personName": "",
            "personLink": "",
            "promocode": "",
            "code": "WRONG-TYPE",
        },
    )

    assert response.status_code == 400
    assert "is for another event" in response.get_json()["msg"]


def test_ticket_type_batch_is_rolled_back_on_later_error(
    manager_context, db_session
):
    client, _, event, _ = manager_context
    from data.ticket_type import TicketType

    response = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=[
            {"action": "add", "name": "Must roll back", "price": 100},
            {"action": "unsupported", "name": "Broken", "price": None},
        ],
    )

    db_session.expire_all()
    names = [item.name for item in TicketType.all_for_event(db_session, event.id)]
    assert response.status_code == 400
    assert names == ["Standard"]


def test_event_access_is_enforced_even_when_role_allows_route(
    client, login, user_factory, db_session, admin
):
    from data._roles import Roles
    from data.event import Event

    user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", datetime(2026, 9, 26, 18, 0))
    db_session.commit()
    login("manager")

    response = client.get("/api/events/{}".format(event.id))

    assert response.status_code == 403
    assert response.get_json() == {"msg": "No permission"}


def test_event_missing_and_duplicate_access_errors(manager_context):
    client, _, event, _ = manager_context

    fetched = client.get("/api/events/{}".format(event.id))
    missing_scanner = client.get("/api/scanner_events/999999")
    missing_update = client.post(
        "/api/events/999999",
        json={"name": "Missing", "date": "2027-01-01T12:00:00"},
    )
    missing_delete = client.delete("/api/events/999999")
    assert fetched.status_code == 200
    assert fetched.get_json()["id"] == event.id
    assert missing_scanner.status_code == 400
    assert missing_update.status_code == 403  # access decorator runs first
    assert missing_delete.status_code == 403


def test_deleted_event_update_delete_and_ticket_type_errors(manager_context):
    client, _, event, _ = manager_context
    assert client.delete("/api/events/{}".format(event.id)).status_code == 200

    invalid_date = client.post(
        "/api/events/{}".format(event.id),
        json={"name": "Still deleted", "date": "invalid"},
    )
    missing_update = client.post(
        "/api/events/{}".format(event.id),
        json={"name": "Still deleted", "date": "2027-01-01T12:00:00"},
    )
    missing_delete = client.delete("/api/events/{}".format(event.id))
    missing_batch = client.post(
        "/api/events/{}/ticket_types".format(event.id), json=[]
    )

    assert invalid_date.status_code == 400
    assert invalid_date.get_json() == {"msg": "date is not datetime"}
    assert missing_update.status_code == 400
    assert "not found" in missing_update.get_json()["msg"]
    assert missing_delete.status_code == 400
    assert "not found" in missing_delete.get_json()["msg"]
    assert missing_batch.status_code == 400
    assert "not found" in missing_batch.get_json()["msg"]


def test_admin_can_list_full_events(logged_in_admin):
    response = logged_in_admin.get("/api/events_full")

    assert response.status_code == 200
    assert response.get_json() == []


def test_admin_add_event_access_errors(logged_in_admin, db_session, user_factory):
    from data._roles import Roles
    from data.event import Event

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(manager, "Manager event", datetime(2027, 1, 1, 12, 0))
    db_session.commit()

    added = logged_in_admin.post("/api/events/{}/add_access".format(event.id))
    duplicate = logged_in_admin.post("/api/events/{}/add_access".format(event.id))
    missing = logged_in_admin.post("/api/events/999999/add_access")

    assert added.status_code == 200
    assert duplicate.status_code == 400
    assert "already has access" in duplicate.get_json()["msg"]
    assert missing.status_code == 400
    assert "not found" in missing.get_json()["msg"]


def test_deleted_event_rejected_before_ticket_type_lookup(manager_context):
    client, _, event, ticket_type = manager_context
    assert client.delete("/api/events/{}".format(event.id)).status_code == 200

    response = client.post(
        "/api/tickets",
        json={
            "eventId": event.id,
            "typeId": ticket_type.id,
            "personName": "Person",
            "personLink": "",
            "promocode": "",
            "code": "DELETED-EVENT",
        },
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "msg": "Event with 'eventId={}' not found".format(event.id)
    }


def test_ticket_create_error_responses(manager_context, db_session):
    client, manager, event, ticket_type = manager_context
    from data.event import Event
    from data.ticket_type import TicketType

    other_event = Event(name="No access", date=datetime(2027, 1, 1, 12, 0))
    db_session.add(other_event)
    db_session.commit()
    other_type, _ = TicketType.add(
        manager, other_event, "Other", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    payload = {
        "eventId": event.id,
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
        "code": "DUPLICATE-CODE",
    }

    assert client.post("/api/tickets", json=payload).status_code == 200
    duplicate = client.post("/api/tickets", json=payload)
    missing_type = client.post(
        "/api/tickets", json={**payload, "typeId": 999999, "code": "MISSING-TYPE"}
    )
    forbidden = client.post(
        "/api/tickets",
        json={
            **payload,
            "eventId": other_event.id,
            "typeId": other_type.id,
            "code": "NO-ACCESS",
        },
    )

    assert duplicate.status_code == 400
    assert "already exist" in duplicate.get_json()["msg"]
    assert missing_type.status_code == 400
    assert "ticketType" in missing_type.get_json()["msg"]
    assert forbidden.status_code == 403


def test_ticket_update_and_delete_error_responses(manager_context, db_session):
    client, manager, event, ticket_type = manager_context
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    ticket, _ = Ticket.new(manager, ticket_type, event, "Person", "", "", "ERRORS")
    other_event = Event.new(manager, "Other", datetime(2027, 2, 1, 12, 0))
    other_type, _ = TicketType.add(
        manager, other_event, "Other", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    payload = {
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
    }

    bad_price = client.post(
        "/api/tickets/{}".format(ticket.id), json={**payload, "price": "100"}
    )
    missing_ticket = client.post("/api/tickets/999999", json=payload)
    missing_type = client.post(
        "/api/tickets/{}".format(ticket.id), json={**payload, "typeId": 999999}
    )
    wrong_type = client.post(
        "/api/tickets/{}".format(ticket.id), json={**payload, "typeId": other_type.id}
    )
    missing_delete = client.delete("/api/tickets/999999")

    assert bad_price.status_code == 400
    assert missing_ticket.status_code == 400
    assert missing_type.status_code == 400
    assert wrong_type.status_code == 400
    assert "another event" in wrong_type.get_json()["msg"]
    assert missing_delete.status_code == 400


def test_ticket_operations_reject_event_without_access(
    client, login, user_factory, db_session, admin
):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    manager = user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", datetime(2027, 3, 1, 12, 0))
    ticket_type, _ = TicketType.add(
        admin, event, "Private", None, datetime(2026, 9, 1, 12, 0)
    )
    ticket, _ = Ticket.new(admin, ticket_type, event, "Person", "", "", "PRIVATE")
    db_session.commit()
    login(manager.login)
    payload = {
        "typeId": ticket_type.id,
        "personName": "Person",
        "personLink": "",
        "promocode": "",
    }

    assert client.post("/api/tickets/{}".format(ticket.id), json=payload).status_code == 403
    assert client.delete("/api/tickets/{}".format(ticket.id)).status_code == 403


def test_check_ticket_wrong_event_response(manager_context, db_session):
    client, manager, event, ticket_type = manager_context
    from data.event import Event
    from data.ticket import Ticket

    ticket, _ = Ticket.new(manager, ticket_type, event, "Person", "", "", "WRONG-EVENT")
    other = Event.new(manager, "Other", datetime(2027, 4, 1, 12, 0))
    db_session.commit()

    response = client.post(
        "/api/check_ticket", json={"code": ticket.code, "eventId": other.id}
    )

    assert response.status_code == 200
    assert response.get_json()["errorCode"] == "event"
    assert response.get_json()["event"]["id"] == event.id


@pytest.mark.parametrize(
    "item, message",
    [
        ({"action": "add", "price": 10}, "name"),
        ({"action": "add", "name": "Bad", "price": "10"}, "price"),
        ({"action": "update", "id": 999999, "name": "Bad", "price": None}, "not found"),
        ({"action": "delete", "id": 999999, "name": "Bad", "price": None}, "not found"),
    ],
)
def test_ticket_type_batch_validation_errors(manager_context, item, message):
    client, _, event, _ = manager_context

    response = client.post(
        "/api/events/{}/ticket_types".format(event.id), json=[item]
    )

    assert response.status_code == 400
    assert message in response.get_json()["msg"]


@pytest.mark.parametrize("action", ["update", "delete"])
def test_ticket_type_batch_cannot_modify_another_event(
    manager_context, db_session, action
):
    client, manager, event, _ = manager_context
    from data.event import Event
    from data.ticket_type import TicketType

    other_event = Event.new(manager, "Other", datetime(2027, 5, 1, 12, 0))
    other_type, _ = TicketType.add(
        manager, other_event, "Protected", 500, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()

    response = client.post(
        "/api/events/{}/ticket_types".format(event.id),
        json=[
            {
                "action": action,
                "id": other_type.id,
                "name": "Tampered",
                "price": 1,
            }
        ],
    )

    db_session.expire_all()
    assert response.status_code == 400
    assert "another event" in response.get_json()["msg"]
    assert TicketType.get(db_session, other_type.id).name == "Protected"


def test_ticket_type_detail_error_responses(
    manager_context, client, login, user_factory, db_session, admin
):
    manager_client, _, event, _ = manager_context
    missing_get = manager_client.get("/api/ticket_types/999999")
    missing_change = manager_client.post(
        "/api/ticket_types/999999", json={"pattern": {}, "img": None}
    )

    assert missing_get.status_code == 400
    assert missing_change.status_code == 400


def test_ticket_type_detail_rejects_missing_access(
    client, login, user_factory, db_session, admin
):
    from data._roles import Roles
    from data.event import Event
    from data.ticket_type import TicketType

    user_factory("manager", "Manager", Roles.manager)
    event = Event.new(admin, "Private", datetime(2027, 6, 1, 12, 0))
    ticket_type, _ = TicketType.add(
        admin, event, "Private", None, datetime(2026, 9, 1, 12, 0)
    )
    db_session.commit()
    login("manager")

    assert client.get("/api/ticket_types/{}".format(ticket_type.id)).status_code == 403
    assert client.post(
        "/api/ticket_types/{}".format(ticket_type.id),
        json={"pattern": {}, "img": None},
    ).status_code == 403


def test_ticket_type_design_rejects_invalid_image(manager_context):
    client, _, _, ticket_type = manager_context

    response = client.post(
        "/api/ticket_types/{}".format(ticket_type.id),
        json={
            "pattern": {},
            "img": {"name": "broken", "data": "invalid", "accessEventId": None},
        },
    )

    assert response.status_code == 400
    assert "base64" in response.get_json()["msg"]


@pytest.mark.parametrize(
    "path,payload",
    [
        ("/api/events", {"name": "Missing date"}),
        ("/api/tickets", {"typeId": 1}),
        ("/api/tickets/999999", {"personName": "Missing type"}),
        ("/api/staff", {"name": "Missing login"}),
    ],
)
def test_required_json_fields_return_client_error(manager_context, path, payload):
    client, _, _, _ = manager_context

    response = client.post(path, json=payload)

    assert response.status_code == 400
    assert set(response.get_json()) == {"msg"}


def test_ticket_type_design_requires_pattern(manager_context):
    client, _, _, ticket_type = manager_context

    response = client.post(
        "/api/ticket_types/{}".format(ticket_type.id), json={"img": None}
    )

    assert response.status_code == 400
    assert "pattern" in response.get_json()["msg"]
