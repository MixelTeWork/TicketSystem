from sqlalchemy import Column, ForeignKey, Integer, orm
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class UserRole(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "UserRole"

    userId = Column(Integer, ForeignKey("User.id"), primary_key=True)
    roleId = Column(Integer, ForeignKey("Role.id"), primary_key=True)

    role = orm.relationship("Role")

    def __repr__(self):
        return f"<UserRole> user: {self.userId} role: {self.roleId}"

    def get_creation_changes(self):
        return [
            ("userId", None, self.userId),
            ("roleId", None, self.roleId),
        ]

    def get_deletion_changes(self):
        return [
            ("userId", self.userId, None),
            ("roleId", self.roleId, None),
        ]
