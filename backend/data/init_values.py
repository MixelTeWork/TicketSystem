from data import db_session
from data.operation import OPERATIONS, Operation
from data.permission import Permission
from data.role import Role
from data.user import User


def init_values():
    db_sess = db_session.create_session()

    role_ticket = Role(name="Билетёр")
    role_manager = Role(name="Управляющий")
    role_admin = Role(name="Админ")
    db_sess.add(role_ticket)
    db_sess.add(role_manager)
    db_sess.add(role_admin)
    db_sess.commit()

    user = User(login="admin", name="Админ", roleId=role_admin.id)
    user.set_password("admin")
    db_sess.add(user)

    db_sess.commit()

    for operation in OPERATIONS:
        db_sess.add(Operation(id=operation, name=OPERATIONS[operation][1]))

    addPermissions(db_sess, role_ticket.id, [
        OPERATIONS["page_scanner"],
    ])
    addPermissions(db_sess, role_manager.id, [
        OPERATIONS["page_scanner"],
        OPERATIONS["page_events"],
    ])
    addPermissions(db_sess, role_admin.id, [
        OPERATIONS["page_scanner"],
        OPERATIONS["page_events"],
    ])

    db_sess.commit()


def addPermissions(db_sess, roleId, operations):
    for operation in operations:
        db_sess.add(Permission(roleId=roleId, operationId=operation[0]))
