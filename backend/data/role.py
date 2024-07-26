from sqlalchemy import Column, DefaultClause, Integer, orm, String, Boolean
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin
from data.log import Actions, Log, Tables

from data.operation import Operation, Operations
from data.permission import Permission
from data.user import User
from data.user_role import UserRole
from utils import get_datetime_now
from .db_session import SqlAlchemyBase


class Role(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Role"

    id      = Column(Integer, primary_key=True, unique=True)
    deleted = Column(Boolean, DefaultClause("0"), nullable=False)
    name    = Column(String(32), nullable=False)

    permissions = orm.relationship("Permission")

    def __repr__(self):
        return f"<Role> [{self.id}] {self.name}"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
        ]

    # def get_dict(self):
    #     return self.to_dict(only=("name"))

    @staticmethod
    def update_roles_permissions(db_sess: Session):
        # add new operations if any
        operations_new = list(Operations.get_all())
        operations_new_ids = list(map(lambda v: v[0], operations_new))
        operations_cur = db_sess.query(Operation).all()
        operations_cur_ids = list(map(lambda v: v.id, operations_cur))
        for operation in operations_new:
            operation_id, operation_name = operation
            if operation_id not in operations_cur_ids:
                db_sess.add(Operation(id=operation_id, name=operation_name))

        # remove operations if it not exist now
        for operation in list(operations_cur):
            if operation.id not in operations_new_ids:
                db_sess.delete(operation)

        # update roles
        roles_new_ids = ROLES.keys()
        roles: list[Role] = db_sess.query(Role).filter(Role.deleted == False).all()
        roles_cur_ids = list(map(lambda v: v.id, roles))
        removed_roles = []
        updated_roles = []
        for role in list(roles):
            if role.id != 1 and role.id not in roles_new_ids:
                role.deleted = True
                removed_roles.append(role.id)
                continue

            if role.id == 1:
                name = "Админ"
                operations = operations_new
            else:
                name = ROLES[role.id]["name"]
                operations = ROLES[role.id]["operations"]
            operations_ids = list(map(lambda v: v[0], operations))

            if role.name != name:
                updated_roles.append((role.id, role.name, name))
                role.name = name

            for permission in list(role.permissions):
                p: Permission = permission
                if p.operationId not in operations_ids:
                    db_sess.delete(permission)

            cur_operations_ids = list(map(lambda v: v.operationId, role.permissions))
            for operation in operations:
                operation_id = operation[0]
                if operation_id not in cur_operations_ids:
                    db_sess.add(Permission(roleId=role.id, operationId=operation_id))

        # add new roles if any
        new_roles = []
        for role_id, role_data in ROLES.items():
            if role_id in roles_cur_ids:
                continue

            role = Role(name=role_data["name"], id=role_id)
            new_roles.append((role_id, role))
            db_sess.add(role)

            for operation in role_data["operations"]:
                db_sess.add(Permission(roleId=role_id, operationId=operation[0]))

        now = get_datetime_now()
        user_admin = db_sess.query(User).join(UserRole).where(UserRole.roleId == Roles.admin).first()

        def log(tableName, actionCode, recordId, changes):
            db_sess.add(Log(
                date=now,
                actionCode=actionCode,
                userId=user_admin.id if user_admin else 1,
                userName=user_admin.name if user_admin else "admin",
                tableName=tableName,
                recordId=recordId,
                changes=changes
            ))

        for role in removed_roles:
            log(Tables.Role, Actions.deleted, role, [])
        for (role_id, old_name, name) in updated_roles:
            log(Tables.Role, Actions.updated, role_id, [("name", old_name, name)])
        for (role_id, role) in new_roles:
            log(Tables.Role, Actions.added, role_id, role.get_creation_changes())

        db_sess.commit()


class Roles:
    admin = 1
    manager = 2
    clerk = 3
    owner = 4


ROLES = {
    Roles.manager: {
        "name": "Организатор",
        "operations": [
            Operations.page_events,
            Operations.page_staff,
            Operations.page_fonts,
            Operations.get_staff_event,
            Operations.add_event,
            Operations.add_ticket,
            Operations.add_staff,
            Operations.add_font,
            Operations.change_event,
            Operations.change_ticket,
            Operations.change_ticket_types,
            Operations.change_staff,
            Operations.change_staff_event,
            Operations.delete_event,
            Operations.delete_ticket,
            Operations.delete_staff,
        ]
    },
    Roles.clerk: {
        "name": "Клерк",
        "operations": [
            Operations.page_events,
            Operations.add_ticket,
            Operations.change_ticket,
            Operations.delete_ticket,
        ]
    },
    Roles.owner: {
        "name": "Владыка",
        "operations": [
            Operations.page_managers,
            Operations.add_manager,
            Operations.delete_manager,
        ]
    },
}
