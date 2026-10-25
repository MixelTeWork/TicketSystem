from datetime import datetime

import pytest

from test_ticket_pagination import ticket_page_context as ticket_page_context


def test_domain_mutations_require_current_transaction_locks(db_session, admin):
    from bafser import ForUpdateRequiredError
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Locks", datetime(2026, 10, 25))
    with pytest.raises(ForUpdateRequiredError):
        TicketType.add(admin, event, "Main", None, datetime(2026, 10, 25))
    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket_type, _ = TicketType.add(admin, event, "Main", None, datetime(2026, 10, 25))
    db_session.commit()
    with pytest.raises(ForUpdateRequiredError):
        Ticket.new(admin, ticket_type, event, "", "", "", "LOCKS")
    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket, error = Ticket.new(admin, ticket_type, event, "", "", "", "LOCKS")
    assert error is None
    with pytest.raises(ForUpdateRequiredError):
        ticket.mark_scanned(admin)
    Ticket.get(ticket.id, for_update=True, db_sess=db_session)
    db_session.rollback()
    with pytest.raises(ForUpdateRequiredError):
        ticket.mark_scanned(admin)
    assert ticket.scanned is False


def test_truncated_names_and_full_normalized_values_stay_in_sync(db_session, admin):
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "я" * 80, datetime(2026, 10, 25))
    assert event.name == "я" * 64
    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket_type, _ = TicketType.add(admin, event, "в" * 80, None, datetime(2026, 10, 25))
    db_session.commit()
    assert ticket_type.name == "в" * 64
    Event.get(event.id, for_update=True, db_sess=db_session)
    ticket, error = Ticket.new(admin, ticket_type, event, "ﬃ" * 260, "", "VIP%_", "CODE-01")
    assert error is None
    assert ticket.personName == "ﬃ" * 256
    assert ticket.person_name_search == "ffi" * 256
    assert ticket.code_search == "code 01"
    assert ticket.promocode_search == "vip"


def test_normalized_search_updates_with_transliteration_and_promocode_filter(ticket_page_context):
    from data.ticket import Ticket

    client, manager, event, standard, _, ids = ticket_page_context
    session = manager.get_session()
    ticket = Ticket.get(ids[0], db_sess=session)
    ticket.update(manager, standard.id, "Фёдор—СЕМЁНОВ  Straße", "", "SALE%_", 0)
    url = f"/api/events/{event.id}/tickets/page"
    for search in ("федор семенов", "fedor semenov", "STRASSE"):
        response = client.post(url, json={"search": search})
        assert response.status_code == 200
        assert [row["id"] for row in response.get_json()["items"]] == [ids[0]]
    assert client.post(url, json={"search": "sale%_"}).get_json()["count"] == 0
    assert client.post(url, json={"search": "%_"}).get_json()["count"] == 31
    assert client.post(url, json={"promocode": "sale%_"}).get_json()["count"] == 1


@pytest.mark.parametrize("optional", [{}, {"price": None}, {"price": 0}])
def test_optional_ticket_fields_have_concrete_model_defaults(ticket_page_context, optional):
    client, _, event, standard, _, _ = ticket_page_context
    response = client.post("/api/tickets", json={
        "eventId": event.id, "typeId": standard.id,
        "personName": "", "personLink": "", "promocode": "", **optional,
    })
    assert response.status_code == 200
    assert response.get_json()["price"] == optional.get("price")
    assert response.get_json()["code"]


def test_ticket_search_migration_backfills_deleted_and_nullable_rows(app, db_session, admin):
    from alembic import command
    from bafser.alembic import create_alembic_config
    from data.event import Event
    from data.ticket import Ticket
    from data.ticket_type import TicketType

    event = Event.new(admin, "Migration", datetime(2026, 10, 25))
    ticket_type = TicketType(eventId=event.id, name="Main", number=0)
    db_session.add(ticket_type)
    db_session.flush()
    tickets = [Ticket(createdDate=event.date, createdById=admin.id, eventId=event.id,
                      typeId=ticket_type.id, code=f"LEGACY%_{index}",
                      personName="Фёдор—Straße" if index == 0 else None,
                      promocode="VIP%_" if index == 0 else None) for index in range(2)]
    tickets[1].deleted = True
    db_session.add_all(tickets)
    db_session.commit()
    ids = [ticket.id for ticket in tickets]
    db_session.rollback()
    config = create_alembic_config(app.config["TEST_DB_KIND"] == "sqlite")
    command.stamp(config, "head")
    try:
        command.downgrade(config, "d7b91c3e5a20")
        command.upgrade(config, "head")
        db_session.expire_all()
        first, second = [Ticket.get(id, includeDeleted=True, db_sess=db_session) for id in ids]
        assert first.person_name_search == "fedor strasse"
        assert first.promocode_search == "vip"
        assert second.person_name_search is None
        assert second.promocode_search is None
        assert second.code_search == "legacy 1"
        assert second.deleted is True
        db_session.rollback()
    finally:
        command.upgrade(config, "head")
