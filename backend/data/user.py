from flask import abort
from sqlalchemy import DefaultClause, ForeignKey, orm, Column, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin

from data.permission_access import PermissionAccess
from .db_session import SqlAlchemyBase
from werkzeug.security import generate_password_hash, check_password_hash


class User(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "User"

    id       = Column(Integer, primary_key=True, unique=True, autoincrement=True)
    deleted  = Column(Boolean, DefaultClause("0"), nullable=False)
    login    = Column(String(32), index=True, unique=True, nullable=False)
    name     = Column(String(32), nullable=False)
    password = Column(String(128), nullable=False)
    roleId   = Column(Integer, ForeignKey("Role.id"), nullable=False)
    bossId   = Column(Integer, ForeignKey("User.id"), nullable=True)

    role = orm.relationship("Role")
    boss = orm.relationship("User")
    access = orm.relationship("PermissionAccess")

    def __repr__(self):
        return f"<User> [{self.id} {self.login}] {self.name}: {self.roleId}"

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def check_permission(self, permission):
        for operation in self.role.operations:
            if operation.id == permission:
                return True
        return False

    def add_access(self, db_sess, eventId):
        db_sess.add(PermissionAccess(userId=self.id, eventId=eventId))

    def has_access(self, eventId):
        for item in self.access:
            if item.eventId == eventId:
                return True
        return False

    def get_creation_changes(self):
        return [
            ("login", None, self.login),
            ("name", None, self.name),
            ("password", None, "***"),
            ("roleId", None, self.roleId),
        ]

    def get_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "role": self.role.name,
            "operations": list(map(lambda v: v.id, self.role.operations)),
        }

    def get_dict_full(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "role": self.role.name,
            "bossId": self.bossId,
            "deleted": self.deleted,
            "access": list(map(lambda v: v.eventId, self.access)),
            "operations": list(map(lambda v: v.id, self.role.operations)),
        }
