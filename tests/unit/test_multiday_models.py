from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import date, datetime, timedelta

import pytest
from bafser import PublicError

if TYPE_CHECKING:
    from data.event import Event
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType
    from data.user import User
    from flask import Flask
    from sqlalchemy.orm import Session

NOW = datetime(2026, 10, 30, 22, 0)
EVENT_DATE = date(2026, 10, 31)


def locked_event(db_session: Session, admin: User, *, two_days: bool = True):
    from data.event import Event

    event = Event.new(admin, "Days", EVENT_DATE, twoDays=two_days)
    return Event.get(event.id, for_update=True, db_sess=db_session)


def add_variant(db_session: Session, admin: User, event: Event, offsets: list[int], *, category: TicketCategory | None = None, name: str = "Variant", quantity: int | None = None):
    from data.event import Event
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType

    Event.get(event.id, for_update=True, db_sess=db_session)
    if category is None:
        category = TicketCategory.add(admin, event, name, NOW)
    variant = TicketType.add(admin, event, name, 100, NOW, category=category, dayOffsets=offsets, quantity=quantity)
    db_session.commit()
    return variant


def add_ticket(db_session: Session, admin: User, event: Event, variant: TicketType, code: str = "CODE"):
    from data.event import Event
    from data.ticket import Ticket

    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket = Ticket.new(admin, variant, event, "Visitor", "", "", code, 0)
    db_session.commit()
    return ticket


@pytest.mark.parametrize("operation", ["delete", "replace", "restore", "event_delete"])
def test_variant_image_lifecycle_refreshes_cached_relationship(app: Flask, db_session: Session, admin: User, operation: str):
    from pathlib import Path

    from sqlalchemy.orm.attributes import set_committed_value

    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    image = Image(name="Current", type="png", creationDate=NOW, createdById=admin.id, accessEventId=event.id)
    db_session.add(image)
    db_session.flush()
    variant.imageId = image.id
    variant.image = image
    if operation == "restore":
        image.deleted = variant.deleted = True
        Path(app.config["IMAGES_FOLDER"], f"{image.id}.png").write_bytes(b"existing image")
    db_session.commit()

    Event.get(event.id, for_update=True, db_sess=db_session)
    variant = TicketType.get(variant.id, includeDeleted=True, for_update=True, db_sess=db_session)
    # The scalar FK is current, but a relationship may already have been read
    # from the authorization transaction's earlier REPEATABLE READ snapshot.
    set_committed_value(variant, "image", None)
    if operation == "delete":
        variant.delete(admin, commit=False)
        assert image.deleted and variant.image is image
    elif operation == "replace":
        replacement = Image(name="Replacement", type="png", creationDate=NOW, createdById=admin.id, accessEventId=event.id)
        db_session.add(replacement)
        db_session.flush()
        variant.update_design(admin, {"width": 600}, replacement)
        assert image.deleted and variant.image is replacement and variant.imageId == replacement.id
    elif operation == "restore":
        with app.app_context():
            assert variant.restore(admin, commit=False)
        assert not image.deleted and variant.image is image and variant.imageId == image.id
    else:
        set_committed_value(event, "ticket_types", [])
        event.delete(admin, commit=False)
        assert image.deleted and variant in event.ticket_types
    db_session.rollback()
    assert image.deleted is (operation == "restore")


def test_period_moves_dates_and_keeps_history_codes_and_price(db_session: Session, admin: User):
    from data.event import Event
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0, 1])
    ticket = add_ticket(db_session, admin, event, variant)
    Ticket.get(ticket.id, for_update=True, db_sess=db_session)
    first = ticket.record_checkin(admin, event.days[0], now=NOW)
    ticket.record_merch_issue(admin, now=NOW)
    db_session.commit()
    day_ids = [day.id for day in event.days]
    Event.get(event.id, for_update=True, db_sess=db_session)
    event.update(admin, event.name, date(2027, 1, 1))
    assert event.date == date(2027, 1, 1) and event.endDate == date(2027, 1, 2)
    assert [day.id for day in event.days] == day_ids
    dto = ticket.get_dict()
    assert dto["validDates"] == ["2027-01-01", "2027-01-02"]
    assert dto["checkins"][0]["dayDate"] == "2027-01-01"
    assert first.checkedAt == NOW and ticket.merchIssuedAt == NOW
    assert ticket.code == "CODE" and ticket.price == 0 and variant.name == "Variant"


def test_shrink_rejects_ticket_even_with_deleted_category_and_rolls_back_other_fields(db_session: Session, admin: User):
    from data.event import Event, EventDaysInUseError

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0, 1])
    add_ticket(db_session, admin, event, variant)
    variant.category.delete(admin)
    Event.get(event.id, for_update=True, db_sess=db_session)
    with pytest.raises(EventDaysInUseError):
        event.update(admin, "Changed", EVENT_DATE + timedelta(days=2), False, twoDays=False)
    assert event.name == "Days" and event.active and event.date == date(2026, 10, 31) and event.day_count == 2


def test_hidden_days_return_and_deleted_ticket_restore_checks_period(db_session: Session, admin: User):
    from data.event import Event

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [1], quantity=5)
    ticket = add_ticket(db_session, admin, event, variant)
    ticket.delete(admin)
    ids = variant.id, event.days[1].id
    Event.get(event.id, for_update=True, db_sess=db_session)
    event.update(admin, event.name, EVENT_DATE, twoDays=False)
    assert event.day_count == 1 and len(event.all_days) == 2
    assert not variant.available and not variant.deleted
    assert not ticket.restore(admin)
    assert ticket.deleted
    Event.get(event.id, for_update=True, db_sess=db_session)
    event.update(admin, event.name, EVENT_DATE, twoDays=True)
    assert (variant.id, event.days[1].id) == ids and variant.available and variant.quantity == 5
    assert ticket.restore(admin)


def test_old_single_day_variant_does_not_gain_second_day(db_session: Session, admin: User):
    from data.event import Event

    event = locked_event(db_session, admin, two_days=False)
    variant = add_variant(db_session, admin, event, [0])
    ticket = add_ticket(db_session, admin, event, variant)
    Event.get(event.id, for_update=True, db_sess=db_session)
    event.update(admin, event.name, EVENT_DATE, twoDays=True)
    assert ticket.get_dict()["dayOffsets"] == [0]
    assert ticket.get_dict()["validDates"] == ["2026-10-31"]


def test_category_unique_sets_restore_saved_settings_and_missing_image_fallback(db_session: Session, admin: User, monkeypatch: pytest.MonkeyPatch):
    from data.event import Event
    from data.img import Image
    from data.ticket_type import TicketType, VariantDaysError

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [1, 0], quantity=2, name="Saved")
    image = Image(name="Gone", type="png", creationDate=NOW, createdById=admin.id, accessEventId=event.id)
    db_session.add(image)
    variant.image = image
    variant.pattern = {"width": 42}
    db_session.commit()
    category = variant.category
    Event.get(event.id, for_update=True, db_sess=db_session)
    with pytest.raises(VariantDaysError):
        TicketType.add(admin, event, "Duplicate", 500, NOW, category=category, dayOffsets=[0, 1])
    variant.delete(admin)
    monkeypatch.setattr(Image, "_on_restore", lambda *_args: False)
    Event.get(event.id, for_update=True, db_sess=db_session)
    restored = TicketType.add(admin, event, "Replacement", 900, NOW, category=category, dayOffsets=[0, 1], quantity=0)
    db_session.commit()
    assert restored.id == variant.id and restored.name == "Saved" and restored.price == 100 and restored.quantity == 2
    assert restored.imageId is None and restored.pattern is None
    assert image.deleted and len(category.variants) == 1


def test_quantity_absent_null_zero_and_invalid_values(db_session: Session, admin: User):
    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0], quantity=10)
    variant.update(admin, "Renamed", 50)
    assert variant.quantity == 10
    variant.update(admin, "Renamed", 50, quantity=None)
    assert variant.quantity is None
    variant.update(admin, "Renamed", 50, quantity=0)
    assert variant.quantity == 0
    for invalid in (True, -1, 1.5, 2_147_483_648):
        with pytest.raises(PublicError):
            variant.update(admin, "Bad", 0, quantity=invalid)
    assert variant.name == "Renamed" and variant.quantity == 0


@pytest.mark.parametrize(
    "day_count,offsets,dates",
    [
        (3, [0, 2], ["2026-10-31", "2026-11-02"]),
        (4, [0, 2, 3], ["2026-10-31", "2026-11-02", "2026-11-03"]),
    ],
)
def test_model_supports_three_and_four_days_without_changing_relationships(db_session: Session, admin: User, day_count: int, offsets: list[int], dates: list[str]):
    from data.event import Event
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    # API still accepts only one/two days; the underlying model has no day enum.
    event.endDate = event.date + timedelta(days=day_count - 1)
    event.ensure_days()
    db_session.commit()
    variant = add_variant(db_session, admin, event, offsets)
    ticket = add_ticket(db_session, admin, event, variant)
    for offset in offsets:
        Ticket.get(ticket.id, for_update=True, db_sess=db_session)
        ticket.record_checkin(admin, event.days[offset], now=NOW + timedelta(days=offset), commit=True)
    assert ticket.get_dict()["validDates"] == dates
    assert len(ticket.checkins) == len(offsets)
    Event.get(event.id, for_update=True, db_sess=db_session)
    event.update(admin, event.name, EVENT_DATE + timedelta(days=10))
    assert event.day_count == day_count


def test_ticket_transfer_preserves_checkins_merch_and_gives_new_rights(db_session: Session, admin: User):
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    first = add_variant(db_session, admin, event, [0])
    both = add_variant(db_session, admin, event, [0, 1], category=first.category)
    ticket = add_ticket(db_session, admin, event, first)
    Ticket.get(ticket.id, for_update=True, db_sess=db_session)
    ticket.record_checkin(admin, event.days[0], now=NOW)
    ticket.record_merch_issue(admin, now=NOW)
    db_session.commit()
    ticket.update(admin, both.id, "Visitor", "", "", 0)
    db_session.commit()
    assert ticket.get_dict()["dayOffsets"] == [0, 1]
    assert [checkin.day.dayOffset for checkin in ticket.checkins] == [0]
    assert ticket.merchIssuedAt == NOW


def test_ticket_creation_is_staged_with_counter_log_and_operation(db_session: Session, admin: User):
    from bafser import Log

    from data.event import Event
    from data.request_operation import RequestOperation
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    before_logs = db_session.query(Log).count()
    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket = Ticket.new(admin, variant, event, "Visitor", "", "", "")
    db_session.add(
        RequestOperation(actorId=admin.id, action="create_ticket", requestId="test", requestHash="x" * 64, ticketId=ticket.id, createdAt=NOW)
    )
    db_session.flush()
    db_session.rollback()
    assert db_session.query(Ticket).count() == 0 and db_session.query(RequestOperation).count() == 0
    assert db_session.query(Log).count() == before_logs and event.lastTicketNumber == 0


def test_direct_constructor_initializes_catalog_explicitly(db_session: Session, admin: User):
    from data.event import Event
    from data.event_day import EventDay
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay

    event = Event(name="Internal", date=EVENT_DATE, endDate=EVENT_DATE)
    db_session.add(event)
    db_session.flush()
    assert event.all_days == []
    assert db_session.query(EventDay).count() == 0
    event.ensure_days()
    db_session.flush()
    category = TicketCategory(eventId=event.id, name="Internal")
    db_session.add(category)
    db_session.flush()
    variant = TicketType(eventId=event.id, name="Internal", number=0, categoryId=category.id, daysKey="0")
    variant.category = category
    link = TicketTypeDay(typeId=variant.id, eventDayId=event.days[0].id)
    link.day = event.days[0]
    variant.days.append(link)
    db_session.add(variant)
    db_session.flush()
    db_session.flush()
    assert event.endDate == date(2026, 10, 31)
    assert db_session.query(EventDay).count() == 1
    assert db_session.query(TicketCategory).count() == 1
    assert variant.day_offsets == [0] and variant.available


def test_direct_constructor_requires_explicit_days(db_session: Session, admin: User):
    from data.event import Event
    from data.event_day import EventDay
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType, VariantDaysError
    from data.ticket_type_day import TicketTypeDay

    event = Event.new(admin, "Explicit catalog", EVENT_DATE)
    category = TicketCategory(eventId=event.id, name="Incomplete")
    db_session.add(category)
    db_session.flush()
    variant = TicketType(eventId=event.id, name="Incomplete", number=0, categoryId=category.id, daysKey="0")
    variant.category = category
    db_session.add(variant)
    with pytest.raises(VariantDaysError, match="Ключ набора дней"):
        db_session.flush()
    assert len(variant.days) == 0
    db_session.rollback()
    assert db_session.query(TicketType).count() == 0
    assert db_session.query(TicketCategory).count() == 0
    assert db_session.query(TicketTypeDay).count() == 0
    assert db_session.query(EventDay).count() == 1


def test_days_keys_and_relationships_are_immutable(db_session: Session, admin: User):
    from data.ticket_type import VariantDaysError

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    with pytest.raises(ValueError):
        event.days[0].dayOffset = 1
    with pytest.raises(ValueError):
        variant.days[0].eventDayId = event.days[1].id
    variant.daysKey = "1"
    with pytest.raises(VariantDaysError):
        db_session.flush()
    db_session.rollback()


def test_two_day_overflow_rejected_before_creation(db_session: Session, admin: User):
    from data.event import Event

    with pytest.raises(PublicError):
        Event.new(admin, "Overflow", date(9999, 12, 31), twoDays=True)
    assert db_session.query(Event).count() == 0


def test_explicit_relationships_create_variant_in_existing_category(db_session: Session, admin: User):
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay

    event = locked_event(db_session, admin)
    first = add_variant(db_session, admin, event, [0])
    category, day = first.category, event.days[1]
    second = TicketType(eventId=event.id, categoryId=first.categoryId, name="Explicit", number=9, daysKey="1")
    second.category = category
    link = TicketTypeDay(typeId=None, eventDayId=day.id)
    link.day = day
    second.days.append(link)
    db_session.add(second)
    db_session.commit()
    assert second.categoryId == first.categoryId and second.day_offsets == [1]


@pytest.mark.parametrize("foreign_relation", ["category", "day"])
def test_explicit_relationships_must_belong_to_variant_event(db_session: Session, admin: User, foreign_relation: str):
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay

    event = locked_event(db_session, admin)
    other_event = locked_event(db_session, admin)
    first = add_variant(db_session, admin, event, [0])
    other = add_variant(db_session, admin, other_event, [0])
    category = other.category if foreign_relation == "category" else first.category
    day = other_event.days[1] if foreign_relation == "day" else event.days[1]
    variant = TicketType(eventId=event.id, categoryId=category.id, name="Wrong event", number=9, daysKey="1")
    variant.category = category
    link = TicketTypeDay(typeId=None, eventDayId=day.id)
    link.day = day
    variant.days.append(link)
    db_session.add(variant)
    with pytest.raises(ValueError, match="другого мероприятия"):
        db_session.flush()
    db_session.rollback()


def test_missing_variant_fk_is_rejected_by_database(db_session: Session, admin: User):
    from sqlalchemy.exc import IntegrityError

    from data.ticket_type_day import TicketTypeDay

    event = locked_event(db_session, admin)
    with pytest.raises(IntegrityError):
        db_session.execute(TicketTypeDay.__table__.insert().values(typeId=None, eventDayId=event.days[0].id))
    db_session.rollback()


@pytest.mark.parametrize("assign_day", [False, True])
def test_raw_foreign_key_cannot_add_day_to_existing_variant(db_session: Session, admin: User, assign_day: bool):
    from data.ticket_type import VariantDaysError
    from data.ticket_type_day import TicketTypeDay

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    second_day = event.days[1]
    link = TicketTypeDay(typeId=variant.id, eventDayId=second_day.id)
    if assign_day:
        link.day = second_day
    assert link.type is None
    db_session.add(link)
    with pytest.raises(VariantDaysError, match="неизменяем"):
        db_session.flush()
    db_session.rollback()
    db_session.expire(variant, ["days"])
    assert variant.daysKey == "0" and variant.day_offsets == [0]


@pytest.mark.parametrize("target,field", [("day", "dayOffset"), ("day", "eventId"), ("link", "eventDayId"), ("link", "typeId")])
def test_expired_day_and_variant_links_still_refuse_changes(db_session: Session, admin: User, target: str, field: str):
    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    item = event.days[0] if target == "day" else variant.days[0]
    original = getattr(item, field)
    db_session.expire(item, [field])
    with pytest.raises(ValueError, match="неизменяем"):
        setattr(item, field, original + 1)
        db_session.flush()
    assert getattr(item, field) == original


def test_ticket_update_is_staged_without_committing(db_session: Session, admin: User):
    from bafser import Log

    event = locked_event(db_session, admin)
    first = add_variant(db_session, admin, event, [0])
    both = add_variant(db_session, admin, event, [0, 1], category=first.category)
    ticket = add_ticket(db_session, admin, event, first)
    before_logs = db_session.query(Log).count()
    ticket.update(admin, both.id, "Changed", "link", "PROMO", 25)
    db_session.flush()
    db_session.rollback()
    assert ticket.typeId == first.id and ticket.personName == "Visitor" and ticket.price == 0
    assert db_session.query(Log).count() == before_logs


def test_ticket_dto_uses_checkins_and_explicit_type_deletion(db_session: Session, admin: User):
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0], name="<Удалён> буквальное название")
    ticket = add_ticket(db_session, admin, event, variant)
    before = ticket.get_dict()
    assert before["type"] == variant.name and before["typeDeleted"] is False
    assert not {"scanned", "scannedBy", "scannedById", "scannedDate"} & before.keys()
    Ticket.get(ticket.id, for_update=True, db_sess=db_session)
    ticket.record_checkin(admin, event.days[0], now=NOW, commit=True)
    variant.delete(admin)
    after = ticket.get_dict()
    assert after["type"] == variant.name and after["typeDeleted"] is True
    assert len(after["checkins"]) == 1 and after["checkins"][0]["checkedById"] == admin.id
    assert not {"scanned", "scannedBy", "scannedById", "scannedDate"} & set(Ticket.__mapper__.attrs.keys())


def test_runtime_stats_have_one_name_and_keep_distinct_scanned_count(db_session: Session, admin: User):
    from data.ticket import Ticket

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0, 1])
    ticket = add_ticket(db_session, admin, event, variant)
    for day in event.days:
        Ticket.get(ticket.id, for_update=True, db_sess=db_session)
        ticket.record_checkin(admin, day, now=NOW + timedelta(days=day.dayOffset), commit=True)
    row, = Ticket.stats_for_event(event.id, db_sess=db_session)
    assert row["name"] == variant.name and "type" not in row
    assert row["categoryId"] == variant.categoryId and row["categoryName"] == variant.category.name
    assert row["count"] == row["scanned"] == 1 and row["checkinCount"] == 2
    variant.category.delete(admin)
    historical, = Ticket.stats_for_event(event.id, db_sess=db_session)
    assert historical["categoryDeleted"] and historical["deleted"]
    assert historical["categoryId"] == variant.categoryId and historical["categoryName"] == variant.category.name
    assert historical["count"] == historical["scanned"] == 1 and historical["checkinCount"] == 2


def test_event_constructor_requires_valid_explicit_end_date():
    from data.event import Event

    with pytest.raises(TypeError, match="endDate"):
        Event(name="Missing end", date=EVENT_DATE)
    with pytest.raises(PublicError):
        Event(name="Wrong end", date=EVENT_DATE, endDate=None)
    with pytest.raises(PublicError, match="раньше"):
        Event(name="Reversed period", date=EVENT_DATE, endDate=EVENT_DATE - timedelta(days=1))


@pytest.mark.parametrize("change", ["append", "remove", "delete", "reassign"])
def test_variant_day_graph_is_immutable_after_creation(db_session: Session, admin: User, change: str):
    from data.ticket_type import VariantDaysError
    from data.ticket_type_day import TicketTypeDay

    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    original_day = variant.days[0].eventDayId
    if change == "append":
        link = TicketTypeDay(typeId=variant.id, eventDayId=event.days[1].id)
        link.day = event.days[1]
        variant.days.append(link)
    elif change == "remove":
        variant.days.pop()
    elif change == "delete":
        db_session.delete(variant.days[0])
    else:
        variant.days[0].day = event.days[1]
    with pytest.raises((ValueError, VariantDaysError), match="неизменяем"):
        db_session.flush()
    db_session.rollback()
    db_session.expire(variant, ["days"])
    assert variant.daysKey == "0" and variant.day_offsets == [0]
    assert [link.eventDayId for link in variant.days] == [original_day]


@pytest.mark.parametrize("target,field", [("day", "dayOffset"), ("link", "eventDayId")])
def test_detached_day_graph_still_refuses_changes(db_session: Session, admin: User, target: str, field: str):
    event = locked_event(db_session, admin)
    variant = add_variant(db_session, admin, event, [0])
    item = event.days[0] if target == "day" else variant.days[0]
    original = getattr(item, field)
    db_session.expunge(item)
    with pytest.raises(ValueError, match="неизменяем"):
        setattr(item, field, original + 1)
    assert getattr(item, field) == original
