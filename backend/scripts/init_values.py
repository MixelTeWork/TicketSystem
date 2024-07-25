import sys
import os


def init_values(dev=False, cmd=False):
    if dev:
        if not os.path.exists("db"):
            os.makedirs("db")
        if cmd:
            add_parent_to_path()
    else:
        add_parent_to_path()

    from data import db_session
    from data.log import Actions, Log, Tables
    from data.operation import Operation, Operations
    from data.permission import Permission
    from data.role import Role, Roles, ROLES
    from data.user import User
    from utils import get_datetime_now

    def init():
        db_session.global_init("dev" in sys.argv)
        db_sess = db_session.create_session()

        for operation in Operations.get_all():
            db_sess.add(Operation(id=operation[0], name=operation[1]))

        roles = []
        for role_id, role_data in ROLES.items():
            role_name = role_data["name"]
            role = Role(name=role_name, id=role_id)
            roles.append(role)
            db_sess.add(role)

            for operation in role_data["operations"]:
                db_sess.add(Permission(roleId=role_id, operationId=operation[0]))

        role_admin = Role(name="Админ", id=Roles.admin)
        roles.append(role_admin)
        db_sess.add(role_admin)

        for operation in Operations.get_all():
            db_sess.add(Permission(roleId=Roles.admin, operationId=operation[0]))

        user_admin = User.new(db_sess, User(id=1, name="Админ"), "admin", "admin", "Админ", [Roles.admin])

        log_changes(db_sess, user_admin, roles)

        if dev:
            init_values_dev(db_sess, user_admin)

    def log_changes(db_sess, user_admin, roles):
        now = get_datetime_now()

        def log(tableName, recordId, changes):
            db_sess.add(Log(
                date=now,
                actionCode=Actions.added,
                userId=user_admin.id,
                userName=user_admin.name,
                tableName=tableName,
                recordId=recordId,
                changes=changes
            ))

        for role in roles:
            log(Tables.Role, role.id, role.get_creation_changes())

        db_sess.commit()

    def init_values_dev(db_sess, user_admin):
        from datetime import timedelta
        from random import randint, choice
        import shutil
        from data.event import Event
        from data.image import Image
        from data.ticket import Ticket
        from data.ticket_type import TicketType
        from utils.randstr import randstr

        users = []
        n = 0
        manager = None
        for i in range(2):
            n += 1
            user = User.new(db_sess, user_admin, f"user{n}", f"user{n}", f"Управляющий {i + 1}", [Roles.manager])
            if manager is None:
                manager = user
            users.append(user)
            for j in range(2):
                n += 1
                staff = User.new(db_sess, user_admin, f"user{n}", f"user{n}", f"Клерк {j + 1}", [Roles.clerk], user.id)
                users.append(staff)
        for j in range(2):
            n += 1
            staff = User.new(db_sess, user_admin, f"user{n}", f"user{n}", f"Клерк {j + 1}", [Roles.clerk], user_admin.id)
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
            user_admin.add_access(event.id, user_admin)
            manager.add_access(event.id, user_admin)
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

    init()


def add_parent_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if __name__ == "__main__":
    init_values("dev" in sys.argv, True)
