import sys
import os


def init_values(dev):
    if dev:
        if not os.path.exists("db"):
            os.makedirs("db")
    else:
        add_parent_to_path()

    from datetime import timedelta
    from random import randint, choice
    from data import db_session
    from data.event import Event
    from data.log import Actions, Log, Tables
    from data.operation import Operation, Operations
    from data.permission import Permission
    from utils.randstr import randstr
    from data.role import Role, Roles
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User
    from utils import get_datetime_now

    ROLES = {
        (Roles.manager, "Управляющий"): [
            Operations.page_events,
            Operations.page_staff,
            Operations.add_event,
            Operations.add_ticket,
            Operations.add_staff,
            Operations.change_event,
            Operations.change_ticket_types,
            Operations.change_staff,
            Operations.delete_event,
            Operations.delete_staff,
        ],
        (Roles.clerk, "Клерк"): [
            Operations.page_events,
            Operations.add_ticket,
        ],
    }

    def init():
        db_session.global_init("db/TicketSystem.db" if dev else None)
        db_sess = db_session.create_session()

        for operation in Operations.get_all():
            db_sess.add(Operation(id=operation[0], name=operation[1]))

        roles = []
        for key in ROLES:
            (role_id, role_name) = key
            role = Role(name=role_name, id=role_id)
            roles.append(role)
            db_sess.add(role)
            db_sess.commit()

            for operation in ROLES[key]:
                db_sess.add(Permission(roleId=role.id, operationId=operation[0]))

        role_admin = Role(name="Админ", id=Roles.admin)
        roles.append(role_admin)
        db_sess.add(role_admin)
        db_sess.commit()

        for operation in Operations.get_all():
            db_sess.add(Permission(roleId=role_admin.id, operationId=operation[0]))

        user_admin = User(login="admin", name="Админ", roleId=role_admin.id)
        user_admin.set_password("admin")
        db_sess.add(user_admin)
        db_sess.commit()

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

        log(Tables.User, user_admin.id, user_admin.get_creation_changes())

        for role in roles:
            log(Tables.Role, role.id, role.get_creation_changes())

        db_sess.commit()

    def init_values_dev(db_sess, user_admin):
        users = []
        n = 0
        for i in range(2):
            n += 1
            user = User(login=f"user{n}", name=f"Управляющий {i + 1}", roleId=Roles.manager)
            user.set_password(f"user{n}")
            users.append(user)
            db_sess.add(user)
            db_sess.commit()
            for j in range(2):
                n += 1
                staff = User(login=f"user{n}", name=f"Клерк {j + 1}", roleId=Roles.clerk)
                staff.set_password(f"user{n}")
                staff.bossId = user.id
                users.append(staff)
                db_sess.add(staff)
        db_sess.commit()

        now = get_datetime_now()
        tcount = 128
        for i in range(3):
            event = Event(name=f"Event {i + 1}", date=now + timedelta(days=i),
                          lastTicketNumber=tcount, lastTypeNumber=3)
            db_sess.add(event)
            db_sess.commit()
            user_admin.add_access(db_sess, event.id)
            types = []
            for j in range(3):
                type = TicketType(eventId=event.id, name=f"TicketType {i}-{j}", number=j)
                types.append(type)
                db_sess.add(type)
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


init_values("dev" in sys.argv)
