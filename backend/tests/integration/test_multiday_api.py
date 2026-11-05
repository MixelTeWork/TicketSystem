from __future__ import annotations

from typing import TYPE_CHECKING

import base64
from datetime import datetime
from uuid import uuid4

import pytest

if TYPE_CHECKING:
    from data.event import EventData
    from data.ticket import TicketData
    from data.ticket_type import CatalogVariantData
    from data.user import User
    from fixture_types import JsonValue, MultidayContext, UserFactory
    from flask.testing import FlaskClient
    from sqlalchemy.orm import Session
    from typing import Any


@pytest.fixture
def multiday(logged_in_admin: FlaskClient):
    client = logged_in_admin
    response = client.post("/api/events", json={"name": "Two days", "date": "2026-10-31T15:00:00Z", "twoDays": True})
    assert response.status_code == 200
    event = response.get_json()
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={
        "categoryChanges": [{"action": "add", "clientId": "standard", "name": "Standard"}],
        "typeChanges": [{"action": "add", "categoryRef": {"clientId": "standard"}, "dayOffsets": days,
                         "name": name, "price": 100, "quantity": None}
                        for name, days in (("First", [0]), ("Second", [1]), ("Both", [0, 1]))],
    })
    assert response.status_code == 200, response.get_json()
    category = response.get_json()["categories"][0]
    return client, event, category, {variant["name"]: variant for variant in category["variants"]}


def update_payload(variant: CatalogVariantData, **values: JsonValue):
    return {"typeId": variant["id"], "personName": "Visitor", "personLink": "", "promocode": "", "price": 0, **values}


def payload(event: EventData, variant: CatalogVariantData, **values: JsonValue):
    return {"requestId": str(uuid4()), "eventId": event["id"], "code": "", **update_payload(variant, **values)}


def create(client: FlaskClient, event: EventData, variant: CatalogVariantData, **values: JsonValue):
    response = client.post("/api/tickets", json=payload(event, variant, **values))
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def scan(client: FlaskClient, event: EventData, ticket: TicketData, operation: str = "entry"):
    return client.post("/api/check_ticket" if operation == "entry" else "/api/issue_merch",
                       json={"eventId": event["id"], "code": ticket["code"]})


def clock(monkeypatch: pytest.MonkeyPatch, value: str):
    monkeypatch.setattr("blueprints.tickets.get_datetime_utc", lambda: datetime.fromisoformat(value))


def test_period_validation_preserves_duration_and_dates(multiday: MultidayContext):
    client, event, _, variants = multiday
    assert event["dayCount"] == 2
    assert event["endDate"] == "2026-11-01"
    ticket = create(client, event, variants["Both"])
    response = client.post(f"/api/events/{event['id']}", json={"name": "Moved", "date": "2026-12-31T15:00:00Z"})
    assert response.status_code == 200
    assert response.get_json()["endDate"] == "2027-01-01"
    moved = client.get(f"/api/events/{event['id']}/tickets").get_json()[0]
    assert moved["validDates"] == ["2026-12-31", "2027-01-01"]
    assert moved["code"] == ticket["code"] and moved["price"] == 0
    before = response.get_json()
    response = client.post(f"/api/events/{event['id']}", json={"name": "Rejected", "date": "2027-02-01T15:00:00Z", "twoDays": False})
    assert response.status_code == 409 and response.get_json()["code"] == "event_days_in_use"
    assert client.get(f"/api/events/{event['id']}").get_json() == before


def test_hidden_historical_days_cannot_overflow_when_moving_single_day_event(multiday: MultidayContext):
    client, event, _, _ = multiday
    url = f"/api/events/{event['id']}"
    shortened = client.post(url, json={"name": event["name"], "date": event["date"], "twoDays": False})
    assert shortened.status_code == 200
    before = shortened.get_json()
    moved = client.post(url, json={"name": "Invalid boundary", "date": "9999-12-31T09:00:00Z"})
    assert moved.status_code == 400
    assert client.get(url).get_json() == before
    catalog = client.get(f"{url}/ticket_categories")
    assert catalog.status_code == 200
    assert all(variant["validDates"] for variant in catalog.get_json()["categories"][0]["variants"])


@pytest.mark.parametrize("value", [None, 0, 1, "true", [], {}])
def test_two_days_is_exact_boolean(multiday: MultidayContext, value: JsonValue):
    client, event, _, _ = multiday
    response = client.post(f"/api/events/{event['id']}", json={"name": "Rejected", "date": event["date"], "twoDays": value})
    assert response.status_code == 400
    assert client.get(f"/api/events/{event['id']}").get_json() == event


def test_hidden_catalog_preserved_and_stale_add_is_atomic(multiday: MultidayContext):
    client, event, category, variants = multiday
    url = f"/api/events/{event['id']}"
    reduced = client.post(url, json={"name": event["name"], "date": event["date"], "twoDays": False})
    assert reduced.status_code == 200
    assert [variant["id"] for variant in client.get(url + "/ticket_types").get_json()] == [variants["First"]["id"]]
    catalog = client.get(url + "/ticket_categories").get_json()
    assert len(catalog["categories"][0]["variants"]) == 3
    rejected = client.post(url + "/ticket_types", json={
        "categoryChanges": [{"action": "update", "id": category["id"], "name": "Must roll back"}],
        "typeChanges": [{"action": "add", "categoryRef": {"id": category["id"]}, "dayOffsets": [1], "name": "Stale"}],
    })
    assert rejected.status_code == 409 and rejected.get_json()["code"] == "catalog_outdated"
    assert client.get(url + "/ticket_categories").get_json() == catalog
    unavailable = client.post("/api/tickets", json=payload(event, variants["Second"]))
    assert unavailable.status_code == 409 and unavailable.get_json()["code"] == "variant_unavailable"
    assert client.post(url, json={"name": event["name"], "date": event["date"], "twoDays": True}).status_code == 200
    assert {variant["id"] for variant in client.get(url + "/ticket_types").get_json()} == {variant["id"] for variant in variants.values()}


def test_catalog_quantity_omission_zero_null_and_restore(multiday: MultidayContext):
    client, event, category, variants = multiday
    variant = variants["Both"]
    url = f"/api/events/{event['id']}/ticket_types"

    def change(values: dict[str, JsonValue]):
        response = client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "update", "id": variant["id"], **values}]})
        assert response.status_code == 200, response.get_json()
        return next(item for item in response.get_json()["categories"][0]["variants"] if item["id"] == variant["id"])

    assert change({"quantity": 100})["quantity"] == 100
    assert change({"name": "Renamed"})["quantity"] == 100
    assert change({"quantity": None})["quantity"] is None
    assert change({"quantity": 0})["quantity"] == 0
    assert client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "delete", "id": variant["id"]}]}).status_code == 200
    restored = client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "add", "categoryRef": {"id": category["id"]},
                                                                                 "dayOffsets": [0, 1], "name": "New defaults", "price": 999, "quantity": 999}]}).get_json()
    actual = next(item for item in restored["categories"][0]["variants"] if item["id"] == variant["id"])
    assert (actual["name"], actual["price"], actual["quantity"]) == ("Renamed", 100, 0)
    duplicate = client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "add", "categoryRef": {"id": category["id"]}, "dayOffsets": [1, 0], "name": "Duplicate"}]})
    assert duplicate.status_code == 409
    immutable = client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "update", "id": variant["id"], "dayOffsets": [0]}]})
    assert immutable.status_code == 400 and "typeChanges" in immutable.get_json()["msg"]


@pytest.mark.parametrize("quantity", [-1, True, 1.5, "2", 2147483648])
def test_catalog_rejects_invalid_quantity(multiday: MultidayContext, quantity: JsonValue):
    client, event, _, variants = multiday
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={"categoryChanges": [], "typeChanges": [
        {"action": "update", "id": variants["First"]["id"], "quantity": quantity}]})
    assert response.status_code == 400


def test_quota_confirmation_replay_conflict_and_deleted_result(multiday: MultidayContext, db_session: Session):
    from bafser import Log

    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    client, event, _, variants = multiday
    variant = variants["First"]
    client.post(f"/api/events/{event['id']}/ticket_types", json={"categoryChanges": [], "typeChanges": [{"action": "update", "id": variant["id"], "quantity": 1}]})
    create(client, event, variant)
    frozen = payload(event, variant)
    warning = client.post("/api/tickets", json=frozen)
    assert warning.status_code == 409
    assert warning.get_json()["details"] == {"typeId": variant["id"], "quantity": 1, "issuedCount": 1, "remaining": 0}
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == 1
    confirmed = client.post("/api/tickets", json={**frozen, "allowOverLimit": True})
    assert confirmed.status_code == 200
    ticket = confirmed.get_json()
    updated = client.post(f"/api/tickets/{ticket['id']}", json=update_payload(variant, personName="Edited"))
    assert updated.status_code == 200
    repeated = client.post("/api/tickets", json=frozen)
    assert repeated.status_code == 200 and repeated.get_json()["personName"] == "Edited"
    conflict = client.post("/api/tickets", json={**frozen, "personName": "Another"})
    assert conflict.status_code == 409 and conflict.get_json()["code"] == "request_id_conflict"
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == 2
    assert db_session.query(Log).filter_by(tableName="Ticket", actionCode="added").count() == 2
    assert client.delete(f"/api/tickets/{ticket['id']}").status_code == 200
    response = client.post("/api/tickets", json=frozen)
    assert response.status_code == 409 and response.get_json()["code"] == "request_result_deleted"


def test_missing_request_and_invalid_uuid_do_not_create(multiday: MultidayContext):
    client, event, _, variants = multiday
    data = payload(event, variants["Both"])
    data.pop("requestId")
    missing = client.post("/api/tickets", json=data)
    assert missing.status_code == 400 and "requestId" in missing.get_json()["msg"]
    assert client.post("/api/tickets", json={**data, "requestId": "bad"}).status_code == 400
    assert client.get(f"/api/events/{event['id']}/tickets").get_json() == []


@pytest.mark.parametrize("error_class", [RuntimeError, ValueError, PermissionError])
def test_failure_after_ticket_flush_rolls_back_everything(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch, db_session: Session, error_class: type[Exception]):
    from bafser import Log

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    client, event, _, variants = multiday

    def failure(self: RequestOperation, **kwargs: Any):
        raise error_class("PRIVATE database details after ticket flush")

    monkeypatch.setattr(RequestOperation, "__init__", failure)
    response = client.post("/api/tickets", json=payload(event, variants["Both"]))
    assert response.status_code == 500
    assert response.get_json() == {"msg": "Internal Server Error"}
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == 0
    assert db_session.query(Log).filter_by(tableName="Ticket").count() == 0
    assert db_session.get(Event, event["id"]).lastTicketNumber == 0


@pytest.mark.parametrize("target", ["event_new", "event_update", "catalog", "ticket_new", "ticket_update", "staff_access"])
def test_mutations_hide_unexpected_exception_text_and_metadata(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch, user_factory: UserFactory, admin: User, target: str):
    from data._roles import Roles
    from data.event import Event
    from data.ticket import Ticket
    from data.user import User

    client, event, _, variants = multiday
    data = payload(event, variants["Both"])
    ticket = create(client, event, variants["Both"]) if target == "ticket_update" else None
    member = user_factory("error_staff", "Staff", Roles.clerk, boss_id=admin.id) if target == "staff_access" else None

    def failure(*args: Any, **kwargs: Any):
        error = PermissionError("PRIVATE staff details") if target == "staff_access" else ValueError("PRIVATE SQL and password")
        error.status = 409
        error.code = "PRIVATE error code"
        error.details = {"password": "PRIVATE password"}
        raise error

    if target == "event_new":
        monkeypatch.setattr(Event, "new", staticmethod(failure))
        response = client.post("/api/events", json={"name": "New", "date": "2026-10-31"})
    elif target == "event_update":
        monkeypatch.setattr(Event, "update", failure)
        response = client.post(f"/api/events/{event['id']}", json={"name": "Changed", "date": "2026-10-31"})
    elif target == "catalog":
        monkeypatch.setattr("blueprints.ticket_types.TicketCategory.add", failure)
        response = client.post(f"/api/events/{event['id']}/ticket_types", json={
            "categoryChanges": [{"action": "add", "clientId": "failure", "name": "Rejected"}], "typeChanges": [],
        })
    elif target == "ticket_new":
        monkeypatch.setattr(Ticket, "new", staticmethod(failure))
        response = client.post("/api/tickets", json=data)
    elif target == "ticket_update":
        monkeypatch.setattr(Ticket, "update", failure)
        response = client.post(f"/api/tickets/{ticket['id']}", json=update_payload(variants["Both"]))
    else:
        monkeypatch.setattr(User, "set_staff_access", failure)
        response = client.post(f"/api/staff/{member.id}/access", json=[])
    assert response.status_code == 500
    assert response.get_json() == {"msg": "Internal Server Error"}


@pytest.mark.parametrize("field,value", [("eventId", 1), ("code", "NEW"), ("requestId", "unused"), ("unexpected", True)])
def test_ticket_update_rejects_unknown_fields(multiday: MultidayContext, field: str, value: JsonValue):
    client, event, _, variants = multiday
    variant = variants["Both"]
    ticket = create(client, event, variant)
    response = client.post(f"/api/tickets/{ticket['id']}", json=update_payload(variant, personName="Rejected", **{field: value}))
    assert response.status_code == 400
    assert f"Unexpected field: {field}" in response.get_json()["msg"]
    assert client.get(f"/api/events/{event['id']}/tickets").get_json()[0]["personName"] == "Visitor"


def test_public_error_subclass_keeps_approved_payload_without_private_cause(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch):
    from bafser import PublicError
    from data.event import Event

    class ApprovedError(PublicError):
        status = 409
        code = "approved_error"
        details = {"remaining": 0}

    def failure(*args: Any, **kwargs: Any):
        raise ApprovedError("Approved message") from ValueError("PRIVATE underlying error")

    client, _, _, _ = multiday
    monkeypatch.setattr(Event, "new", staticmethod(failure))
    response = client.post("/api/events", json={"name": "New", "date": "2026-10-31"})
    assert response.status_code == 409
    assert response.get_json() == {"msg": "Approved message", "code": "approved_error", "details": {"remaining": 0}}


def test_global_public_error_handler_rolls_back_pending_ticket(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch, db_session: Session):
    from bafser import Log, PublicError

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    client, event, _, variants = multiday

    def failure(self: RequestOperation, **kwargs: Any):
        raise PublicError("Approved rejection", status=409, code="approved_error", details={"remaining": 0})

    monkeypatch.setattr(RequestOperation, "__init__", failure)
    response = client.post("/api/tickets", json=payload(event, variants["Both"]))
    assert response.status_code == 409
    assert response.get_json() == {"msg": "Approved rejection", "code": "approved_error", "details": {"remaining": 0}}
    db_session.rollback()
    assert db_session.query(Ticket).count() == db_session.query(RequestOperation).count() == 0
    assert db_session.query(Log).filter_by(tableName="Ticket").count() == 0
    assert db_session.get(Event, event["id"]).lastTicketNumber == 0


def test_entry_days_moscow_boundary_merch_and_move(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch):
    client, event, _, variants = multiday
    ticket = create(client, event, variants["Both"])
    clock(monkeypatch, "2026-10-30T20:59:59")
    assert scan(client, event, ticket).get_json()["errorCode"] == "date"
    merch = scan(client, event, ticket, "merch").get_json()
    assert merch["success"] and merch["operation"] == "merch" and merch["ticket"]["checkins"] == []
    clock(monkeypatch, "2026-10-30T21:00:00")
    first = scan(client, event, ticket).get_json()
    assert first["success"] and first["checkin"]["dayOffset"] == 0
    repeat = scan(client, event, ticket).get_json()
    assert repeat["errorCode"] == "scanned" and repeat["checkin"] == first["checkin"]
    clock(monkeypatch, "2026-10-31T21:00:00")
    second = scan(client, event, ticket).get_json()
    assert second["success"] and second["checkin"]["dayOffset"] == 1
    assert len(second["ticket"]["checkins"]) == 2
    assert scan(client, event, ticket, "merch").get_json()["ticket"]["merchIssuedAt"] == merch["ticket"]["merchIssuedAt"]
    moved = client.post(f"/api/events/{event['id']}", json={"name": event["name"], "date": "2026-12-31T15:00:00Z"})
    assert moved.status_code == 200
    clock(monkeypatch, "2026-12-30T21:00:00")
    moved_repeat = scan(client, event, ticket).get_json()
    assert moved_repeat["errorCode"] == "scanned"
    assert moved_repeat["checkin"]["checkedAt"] == first["checkin"]["checkedAt"]
    assert moved_repeat["checkin"]["dayDate"] == "2026-12-31"
    stats = next(row for row in client.get(f"/api/events/{event['id']}/tickets_stats").get_json() if row["typeId"] == variants["Both"]["id"])
    assert (stats["count"], stats["scanned"], stats["checkinCount"], stats["merchIssued"]) == (1, 1, 2, 1)


def test_second_day_without_first_and_single_day_history(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch):
    client, event, _, variants = multiday
    ticket = create(client, event, variants["Second"])
    clock(monkeypatch, "2026-10-31T21:00:00")
    scanned = scan(client, event, ticket).get_json()
    assert scanned["success"]
    edited = client.post(f"/api/tickets/{ticket['id']}", json={"typeId": variants["First"]["id"], "personName": "Moved", "personLink": "", "promocode": "", "price": 0})
    assert edited.status_code == 200 and edited.get_json()["checkins"] == scanned["ticket"]["checkins"]
    reduced = client.post(f"/api/events/{event['id']}", json={"name": event["name"], "date": event["date"], "twoDays": False})
    assert reduced.status_code == 200
    clock(monkeypatch, "2028-01-01T01:00:00")
    repeat = scan(client, event, ticket).get_json()
    assert repeat["errorCode"] == "scanned" and repeat["checkin"]["dayOffset"] == 1


def test_deleted_category_tickets_scan_block_shrink_and_replay(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch):
    client, event, category, variants = multiday
    frozen = payload(event, variants["Both"])
    ticket = client.post("/api/tickets", json=frozen).get_json()
    response = client.post(f"/api/events/{event['id']}/ticket_types", json={"categoryChanges": [{"action": "delete", "id": category["id"]}], "typeChanges": []})
    assert response.status_code == 200 and response.get_json()["categories"] == []
    assert client.post("/api/tickets", json=frozen).get_json()["id"] == ticket["id"]
    denied = client.post("/api/tickets", json=payload(event, variants["Both"]))
    assert denied.status_code == 409 and denied.get_json()["code"] == "variant_unavailable"
    assert client.post(f"/api/events/{event['id']}", json={"name": event["name"], "date": event["date"], "twoDays": False}).status_code == 409
    clock(monkeypatch, "2026-10-31T00:00:00")
    assert scan(client, event, ticket).get_json()["success"]


def test_transfer_quota_only_on_changed_type_and_history_preserved(multiday: MultidayContext, monkeypatch: pytest.MonkeyPatch):
    client, event, _, variants = multiday
    ticket = create(client, event, variants["First"])
    clock(monkeypatch, "2026-10-31T00:00:00")
    first = scan(client, event, ticket).get_json()
    merch = scan(client, event, ticket, "merch").get_json()
    client.post(f"/api/events/{event['id']}/ticket_types", json={"categoryChanges": [], "typeChanges": [{"action": "update", "id": variants["Both"]["id"], "quantity": 0}]})
    edit = {"typeId": variants["Both"]["id"], "personName": "Transfer", "personLink": "", "promocode": "", "price": 5}
    assert client.post(f"/api/tickets/{ticket['id']}", json=edit).status_code == 409
    moved = client.post(f"/api/tickets/{ticket['id']}", json={**edit, "allowOverLimit": True})
    assert moved.status_code == 200
    assert moved.get_json()["checkins"] == first["ticket"]["checkins"]
    assert moved.get_json()["merchIssuedAt"] == merch["ticket"]["merchIssuedAt"]
    assert client.post(f"/api/tickets/{ticket['id']}", json={**edit, "personName": "Simple edit"}).status_code == 200
    clock(monkeypatch, "2026-11-01T00:00:00")
    assert scan(client, event, ticket).get_json()["success"]


def test_restore_image_rolls_back_with_next_catalog_error(multiday: MultidayContext, db_session: Session):
    from data.img import Image
    from data.ticket_type import TicketType

    client, event, category, variants = multiday
    variant = variants["First"]
    encoded = base64.b64encode(b"\x89PNG\r\n\x1a\nmultiday-background").decode("ascii")
    designed = client.post(f"/api/ticket_types/{variant['id']}", json={"pattern": {"width": 600, "height": 300, "objects": []},
        "img": {"name": "Background", "data": "data:image/png;base64," + encoded, "accessEventId": event["id"]}})
    assert designed.status_code == 200
    image_id = designed.get_json()["imageId"]
    url = f"/api/events/{event['id']}/ticket_types"
    assert client.post(url, json={"categoryChanges": [], "typeChanges": [{"action": "delete", "id": variant["id"]}]}).status_code == 200
    response = client.post(url, json={"categoryChanges": [], "typeChanges": [
        {"action": "add", "categoryRef": {"id": category["id"]}, "dayOffsets": [0], "name": "Restore"},
        {"action": "update", "id": 999999, "name": "Invalid next change"},
    ]})
    assert response.status_code == 400
    db_session.rollback()
    assert TicketType.get(variant["id"], includeDeleted=True, db_sess=db_session).deleted
    assert Image.get(image_id, includeDeleted=True, db_sess=db_session).deleted


def test_replay_authorization_and_manual_work_of_other_actor(multiday: MultidayContext, user_factory: UserFactory, db_session: Session):
    from data._roles import Roles
    from data.permission_access import PermissionAccess
    from data.user import User

    client, event, _, variants = multiday
    frozen = payload(event, variants["First"])
    first = client.post("/api/tickets", json=frozen).get_json()
    clerk = user_factory("independent_clerk", "Clerk", Roles.clerk)
    admin = User.get_admin(db_sess=db_session)
    clerk.add_access(event["id"], admin)
    other = client.application.test_client()
    assert other.post("/api/auth", json={"login": "independent_clerk", "password": "password"}).status_code == 200
    # The operation key is scoped to the actor, not to personal data or event.
    second = other.post("/api/tickets", json=frozen)
    assert second.status_code == 200 and second.get_json()["id"] != first["id"]
    assert other.get(f"/api/events/{event['id']}/ticket_categories").status_code == 403
    db_session.query(PermissionAccess).filter_by(userId=admin.id, eventId=event["id"]).delete()
    db_session.commit()
    assert client.post("/api/tickets", json=frozen).status_code == 403


def test_ticket_deletion_state_is_explicit_and_names_are_literal(multiday: MultidayContext):
    client, event, category, variants = multiday
    variant = variants["First"]
    literal_name = "<Удалён> literal name"
    url = f"/api/events/{event['id']}"
    changed = client.post(url + "/ticket_types", json={
        "categoryChanges": [], "typeChanges": [{"action": "update", "id": variant["id"], "name": literal_name}],
    })
    assert changed.status_code == 200
    ticket = create(client, event, variant)
    assert ticket["type"] == literal_name and ticket["typeDeleted"] is False
    assert {"scanned", "scannedDate", "scannedById", "scannedBy"}.isdisjoint(ticket)
    deleted = client.post(url + "/ticket_types", json={
        "categoryChanges": [{"action": "delete", "id": category["id"]}], "typeChanges": [],
    })
    assert deleted.status_code == 200
    listed = client.get(url + "/tickets").get_json()[0]
    assert listed["type"] == literal_name and listed["typeDeleted"] is True
    page = client.post(url + "/tickets/page", json={}).get_json()
    page_type = next(item for item in page["types"] if item["id"] == variant["id"])
    assert page_type == {"id": variant["id"], "name": literal_name, "deleted": True}
    stats = client.get(url + "/tickets_stats").get_json()
    assert len(stats) == 1
    assert stats[0]["name"] == literal_name and stats[0]["count"] == 1
    assert "type" not in stats[0]
