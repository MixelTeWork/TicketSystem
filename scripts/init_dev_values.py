import sys
import os


def init_dev_values(dev=False, cmd=False):
    print(f"init_dev_values {dev=}")
    if cmd:
        add_parent_to_path()

    from datetime import timedelta
    from random import randint, choice
    import shutil

    from bafser import db_session, get_datetime_now, randstr
    from data._roles import Roles
    from data.event import Event
    from data.img import Image
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User

    db_session.global_init(dev)
    db_sess = db_session.create_session()
    user_admin = User.get_admin(db_sess)

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

    now = get_datetime_now()
    shutil.copy("scripts/dev_init_data/1.jpeg", "images/1.jpeg")
    img = Image(id=1, name="img1", type="jpeg", accessEventId=1, createdById=user_admin.id, creationDate=now)
    db_sess.add(img)

    tcount = 128
    for i in range(3):
        event = Event(name=f"Event {i + 1}", date=now + timedelta(days=i),
                      lastTicketNumber=tcount, lastTypeNumber=3)
        db_sess.add(event)
        db_sess.commit()
        user_admin.add_access(event.id, user_admin, commit=False)
        manager.add_access(event.id, user_admin, commit=False)
        types = []
        for j in range(3):
            ttype = TicketType(eventId=event.id, name=f"TicketType {i}-{j}", number=j)
            if i == 2 and j == 0:
                ttype.imageId = 1
                ttype.pattern = {"height": 720, "width": 1280, "objects": [
                    {"type": "qr", "x": 968, "y": 18, "w": 292, "h": 292, "c": "#fddb3d", "f": -1},
                    {"type": "name", "x": 56, "y": 44, "w": 875, "h": 58, "c": "#41ff33", "f": -1},
                    {"type": "promo", "x": 0, "y": 0, "w": 0, "h": 0, "c": "#000000", "f": -1}
                ]}
            types.append(ttype)
            db_sess.add(ttype)
        db_sess.commit()
        for j in range(tcount):
            creation_rand_minutes = randint(1, 60 * 24 * 5)
            ttype = randint(0, 2)
            ticket = Ticket(
                createdDate=now - timedelta(minutes=creation_rand_minutes),
                createdById=choice(users).id,
                eventId=event.id,
                typeId=types[ttype].id,
                personName=randstr(randint(5, 15)),
                promocode=randstr(randint(5, 15)) if randint(0, 1) == 0 else None,
            )
            ticket.set_code(event.date, j, ttype)
            ticket.personLink = "http://person.dev/" + ticket.personName
            if randint(0, 1) == 0:
                ticket.scanned = True
                ticket.scannedDate = ticket.createdDate + timedelta(minutes=creation_rand_minutes // 2)
                ticket.scannedById = choice(users).id
            db_sess.add(ticket)

    db_sess.commit()
    db_sess.close()


def add_parent_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if __name__ == "__main__":
    init_dev_values("dev" in sys.argv, True)
