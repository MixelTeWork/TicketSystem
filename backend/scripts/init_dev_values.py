import os
import sys
from pathlib import Path

from bafser import AppConfig
from sqlalchemy.orm import Session

import bafser_config


def init_dev_values(db_sess: Session, _config: AppConfig | None = None):

    import shutil
    from datetime import timedelta
    from random import choice, randint

    from bafser import get_datetime_utc, randstr

    from data._roles import Roles
    from data.event import Event
    from data.img import Image
    from data.ticket import Ticket
    from data.ticket_category import TicketCategory
    from data.ticket_checkin import TicketCheckin
    from data.ticket_type import TicketType
    from data.ticket_type_day import TicketTypeDay
    from data.user import User
    from utils.dates import as_moscow

    user_admin = User.get_admin(db_sess=db_sess)
    if user_admin is None:
        raise RuntimeError("Initialize the database before adding development values")
    if db_sess.query(Event).first() is not None:
        raise RuntimeError("Development values require an empty events table")

    users: list[User] = []
    n = 0
    manager = None
    for i in range(2):
        n += 1
        user = User.new(user_admin, f"user{n}", f"user{n}", f"Управляющий {i + 1}", [Roles.manager])
        if manager is None:
            manager = user
        users.append(user)
        for j in range(2):
            n += 1
            staff = User.new(user_admin, f"user{n}", f"user{n}", f"Клерк {j + 1}", [Roles.clerk], user.id)
            users.append(staff)
    for j in range(2):
        n += 1
        staff = User.new(user_admin, f"user{n}", f"user{n}", f"Клерк {j + 1}", [Roles.clerk], user_admin.id)
        users.append(staff)

    now = get_datetime_utc()
    tcount = 128
    checkins = []
    for i in range(4):
        multiday = i == 3
        event_date = as_moscow(now).date() + timedelta(days=-1 if multiday else i)
        event = Event(name="Двухдневный фестиваль" if multiday else f"Event {i + 1}",
                      date=event_date, endDate=event_date + timedelta(days=int(multiday)),
                      lastTicketNumber=tcount, lastTypeNumber=9 if multiday else 3)
        event.ensure_days()
        db_sess.add(event)
        db_sess.commit()
        if i == 0:
            images_folder = Path(bafser_config.images_folder)
            images_folder.mkdir(parents=True, exist_ok=True)
            shutil.copy(Path(__file__).parent / "dev_init_data" / "1.jpeg", images_folder / "1.jpeg")
            img = Image(name="img1", type="jpeg", accessEventId=event.id, createdById=user_admin.id, creationDate=now)
            img.id = 1
            db_sess.add(img)
            db_sess.flush()
        user_admin.add_access(event.id, user_admin, commit=False)
        manager.add_access(event.id, user_admin, commit=False)
        days = list(event.days)
        first_day = days[0]
        types = []
        for j in range(3):
            category = TicketCategory(eventId=event.id, name=["Стандарт", "Льготный", "Пригласительный"][j] if multiday else f"TicketType {i}-{j}")
            db_sess.add(category)
            db_sess.flush()
            for offsets in ([(0,), (1,), (0, 1)] if multiday else [(0,)]):
                suffix = "оба дня" if len(offsets) == 2 else "первый день" if offsets[0] == 0 else "второй день"
                ttype = TicketType(eventId=event.id, name=f"{category.name} — {suffix}" if multiday else category.name,
                                   number=len(types), categoryId=category.id, daysKey=",".join(map(str, offsets)))
                ttype.category = category
                for offset in offsets:
                    link = TicketTypeDay(typeId=ttype.id, eventDayId=days[offset].id)
                    link.day = days[offset]
                    ttype.days.append(link)
                if multiday:
                    ttype.price = ([900, 500, 0] if len(offsets) == 2 else [500, 300, 0])[j]
                    ttype.quantity = 50 if j == 0 else None
                if i == 2 and j == 0:
                    ttype.imageId = 1
                    ttype.pattern = {
                        "height": 720,
                        "width": 1280,
                        "objects": [
                            {"type": "qr", "x": 968, "y": 18, "w": 292, "h": 292, "c": "#fddb3d", "f": -1},
                            {"type": "name", "x": 56, "y": 44, "w": 875, "h": 58, "c": "#41ff33", "f": -1},
                            {"type": "promo", "x": 0, "y": 0, "w": 0, "h": 0, "c": "#000000", "f": -1},
                        ],
                    }
                types.append(ttype)
                db_sess.add(ttype)
        db_sess.commit()
        for j in range(tcount):
            creation_rand_minutes = randint(1, 60 * 24 * 5)
            ttype = j % len(types) if multiday else randint(0, 2)
            ticket = Ticket(
                createdDate=now - timedelta(minutes=creation_rand_minutes),
                createdById=choice(users).id,
                eventId=event.id,
                typeId=types[ttype].id,
                code="",
                personName=randstr(randint(5, 15)),
                promocode=randstr(randint(5, 15)) if randint(0, 1) == 0 else None,
            )
            ticket.generate_code(event.date, j, ttype)
            ticket.personLink = "http://person.dev/" + ticket.personName
            if multiday:
                ticket.price = types[ttype].price
                if j % 4 == 0:
                    ticket.merchIssuedAt = now
                    ticket.merchIssuedById = user_admin.id
            db_sess.add(ticket)
            if multiday:
                if j % 4 != 0:
                    for offset in types[ttype].day_offsets:
                        checkins.append((ticket, days[offset].id, now - timedelta(days=1 - offset), user_admin.id))
            elif randint(0, 1) == 0:
                checkins.append((ticket, first_day.id,
                                 ticket.createdDate + timedelta(minutes=creation_rand_minutes // 2),
                                 choice(users).id))

    db_sess.flush()
    db_sess.add_all(TicketCheckin(ticketId=ticket.id, eventDayId=day_id,
                                 checkedAt=checked_at, checkedById=user_id)
                    for ticket, day_id, checked_at, user_id in checkins)
    db_sess.commit()


def add_parent_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if __name__ == "__main__":
    from bafser import db_session

    add_parent_to_path()
    db_session.global_init("dev" in sys.argv)
    with db_session.create_session() as db_sess:
        init_dev_values(db_sess)
