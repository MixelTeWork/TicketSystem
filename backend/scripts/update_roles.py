import sys
import os


def update_roles(dev):
    add_parent_to_path()
    if dev:
        if not os.path.exists("db"):
            os.makedirs("db")

    from datetime import timedelta
    from random import randint, choice
    from data import db_session
    from data.event import Event
    from data.log import Actions, Log, Tables
    from data.operation import Operation, Operations
    from data.permission import Permission
    from utils.randstr import randstr
    from data.role import Role, Roles, ROLES
    from data.ticket import Ticket
    from data.ticket_type import TicketType
    from data.user import User
    from utils import get_datetime_now

    def find(lst, cf):
        for x in lst:
            if cf(x):
                return x
        return None

    def init():
        db_session.global_init(dev)
        db_sess = db_session.create_session()

        operations_cur = db_sess.query(Operation).all()
        new_operations = []
        for operation in Operations.get_all():
            if not find(operations_cur, lambda x: x.id == operation[0]):
                db_sess.add(Operation(id=operation[0], name=operation[1]))
                new_operations.append(operation[0])

        roles_cur = db_sess.query(Role).all()
        new_roles = []
        for key, operations in ROLES.items():
            (role_id, role_name) = key
            if not find(roles_cur, lambda x: x.id == role_id):
                role = Role(name=role_name, id=role_id)
                new_roles.append(role)
                db_sess.add(role)
                db_sess.commit()

                for operation in operations:
                    db_sess.add(Permission(roleId=role.id, operationId=operation[0]))

        for operationId in new_operations:
            db_sess.add(Permission(roleId=Roles.admin, operationId=operationId))

        log_changes(db_sess, new_operations, new_roles)

    def log_changes(db_sess, operations, roles):
        now = get_datetime_now()

        def log(tableName, recordId, changes):
            db_sess.add(Log(
                date=now,
                actionCode=Actions.added,
                userId=Roles.admin,
                userName="Админ",
                tableName=tableName,
                recordId=recordId,
                changes=changes
            ))

        for operation in operations:
            print("Added:", operation)

        for role in roles:
            log(Tables.Role, role.id, role.get_creation_changes())
            print("Added:", role)

        db_sess.commit()

    init()


def add_parent_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


update_roles("dev" in sys.argv)
