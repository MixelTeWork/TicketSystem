from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def test_dev_seed_includes_single_and_multiday_events(db_session: Session):
    from data.event import Event
    from data.img import Image
    from data.ticket import Ticket
    from data.ticket_category import TicketCategory
    from data.ticket_checkin import TicketCheckin
    from scripts.init_dev_values import init_dev_values

    init_dev_values(db_session)

    db_session.expire_all()
    assert db_session.query(Event).count() == 4
    assert db_session.query(Ticket).count() == 512
    assert len({ticket.code for ticket in db_session.query(Ticket)}) == 512
    assert db_session.get(Image, 1) is not None
    events = db_session.query(Event).all()
    single_day = [event for event in events if event.day_count == 1]
    assert len(single_day) == 3
    assert all(len(event.days) == 1 for event in single_day)
    assert all(ttype.category is not None and ttype.day_offsets == [0]
               for event in single_day for ttype in event.ticket_types)
    multiday = next(event for event in events if event.day_count == 2)
    assert multiday.name == "Двухдневный фестиваль"
    assert [day.dayOffset for day in multiday.days] == [0, 1]
    categories = db_session.query(TicketCategory).filter_by(eventId=multiday.id).all()
    assert {category.name for category in categories} == {"Стандарт", "Льготный", "Пригласительный"}
    assert len(multiday.ticket_types) == 9
    for category in categories:
        assert {tuple(ttype.day_offsets) for ttype in multiday.ticket_types if ttype.categoryId == category.id} == {(0,), (1,), (0, 1)}
    tickets = db_session.query(Ticket).filter_by(eventId=multiday.id).all()
    assert len(tickets) == 128
    assert {ticket.typeId for ticket in tickets} == {ttype.id for ttype in multiday.ticket_types}
    assert any(ticket.price == 0 for ticket in tickets)
    assert any(ticket.merchIssuedAt is not None for ticket in tickets)
    assert any(ticket.merchIssuedAt is None for ticket in tickets)
    multiday_checkins = db_session.query(TicketCheckin).filter(TicketCheckin.ticketId.in_([ticket.id for ticket in tickets])).all()
    assert {checkin.eventDayId for checkin in multiday_checkins} == {day.id for day in multiday.days}
    assert all(checkin.day.dayOffset in checkin.ticket.type.day_offsets for checkin in multiday_checkins)
    assert db_session.query(TicketCheckin).count() > 0
    checked = db_session.query(TicketCheckin).first()
    assert checked.checkedAt is not None and checked.checkedById is not None
    assert any(entry["eventDayId"] == checked.eventDayId for entry in checked.ticket.get_dict()["checkins"])

    with pytest.raises(RuntimeError, match="empty events table"):
        init_dev_values(db_session)

    assert db_session.query(Event).count() == 4
