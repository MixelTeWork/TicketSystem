from data import db_session
from data.operation import Operation
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

    # operations
    db_sess.add(Operation(id="page_scanner", name="Страница сканер"))
    db_sess.add(Operation(id="page_events", name="Страница мероприятия"))

    # permissions
    db_sess.add(Permission(roleId=role_ticket.id, operationId="page_scanner"))

    db_sess.add(Permission(roleId=role_manager.id, operationId="page_events"))

    db_sess.add(Permission(roleId=role_admin.id, operationId="page_scanner"))
    db_sess.add(Permission(roleId=role_admin.id, operationId="page_events"))

    db_sess.commit()

