from sqlalchemy import Column, DefaultClause, Integer, orm, String, Boolean
from sqlalchemy_serializer import SerializerMixin

from data.operation import Operations
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


class Roles:
    admin = 1
    manager = 2
    clerk = 3


ROLES = {
    (Roles.manager, "Управляющий"): [
        Operations.page_events,
        Operations.page_staff,
        Operations.get_staff_event,
        Operations.add_event,
        Operations.add_ticket,
        Operations.add_staff,
        Operations.change_event,
        Operations.change_ticket,
        Operations.change_ticket_types,
        Operations.change_staff,
        Operations.change_staff_event,
        Operations.delete_event,
        Operations.delete_ticket,
        Operations.delete_staff,
    ],
    (Roles.clerk, "Клерк"): [
        Operations.page_events,
        Operations.add_ticket,
        Operations.change_ticket,
        Operations.delete_ticket,
    ],
}
