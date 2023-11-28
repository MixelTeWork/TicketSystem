from datetime import datetime, timedelta, timezone
from sqlalchemy import DefaultClause, ForeignKey, orm, Column, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from werkzeug.security import generate_password_hash, check_password_hash

from data.permission_access import PermissionAccess
from data.log import Actions, Log, Tables
from .db_session import SqlAlchemyBase


class User(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "User"

    id       = Column(Integer, primary_key=True, unique=True, autoincrement=True)
    deleted  = Column(Boolean, DefaultClause("0"), nullable=False)
    login    = Column(String(64), index=True, unique=True, nullable=False)
    name     = Column(String(64), nullable=False)
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
        for p in self.role.permissions:
            if p.operation.id == permission:
                return True
        return False

    def add_access(self, db_sess, eventId, initiator):
        access = PermissionAccess(userId=self.id, eventId=eventId)
        db_sess.add(access)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.added,
            userId=initiator.id,
            userName=initiator.name,
            tableName=Tables.PermissionAccess,
            recordId=self.id,
            changes=access.get_creation_changes()
        ))

    def remove_access(self, db_sess, eventId, initiator):
        access = None
        for item in self.access:
            if item.eventId == eventId:
                access = item
                break
        if access is None:
            return
        db_sess.delete(access)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.deleted,
            userId=initiator.id,
            userName=initiator.name,
            tableName=Tables.PermissionAccess,
            recordId=self.id,
            changes=access.get_deletion_changes()
        ))

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
            "operations": list(map(lambda v: v.operation.id, self.role.permissions)),
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
            "operations": list(map(lambda v: v.operation.id, self.role.permissions)),
        }


def get_datetime_now():
    return datetime.now(timezone.utc) + timedelta(hours=3)
