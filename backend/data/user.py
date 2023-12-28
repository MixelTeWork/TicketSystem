from datetime import datetime, timedelta, timezone
from sqlalchemy import DefaultClause, ForeignKey, orm, Column, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from werkzeug.security import generate_password_hash, check_password_hash

from data.permission_access import PermissionAccess
from data.log import Actions, Log, Tables
from data.user_role import UserRole
from .db_session import SqlAlchemyBase


class User(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "User"

    id       = Column(Integer, primary_key=True, unique=True, autoincrement=True)
    deleted  = Column(Boolean, DefaultClause("0"), nullable=False)
    login    = Column(String(64), index=True, unique=True, nullable=False)
    name     = Column(String(64), nullable=False)
    password = Column(String(128), nullable=False)
    bossId   = Column(Integer, ForeignKey("User.id"), nullable=True)

    roles = orm.relationship("UserRole")
    boss = orm.relationship("User")
    access = orm.relationship("PermissionAccess")

    def __repr__(self):
        return f"<User> [{self.id} {self.login}] {self.name}"

    @staticmethod
    def new(db_sess, actor, login, password, name, roles, bossId=None):
        user = User(login=login, name=name, bossId=bossId)
        user.set_password(password)
        db_sess.add(user)

        now = get_datetime_now()
        log = Log(
            date=now,
            actionCode=Actions.added,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.User,
            recordId=-1,
            changes=user.get_creation_changes()
        )
        db_sess.add(log)
        db_sess.commit()

        userId = user.id
        log.recordId = user.id

        for roleId in roles:
            user_role = UserRole(userId=userId, roleId=roleId)
            db_sess.add(user_role)
            db_sess.add(Log(
                date=now,
                actionCode=Actions.added,
                userId=actor.id,
                userName=actor.name,
                tableName=Tables.UserRole,
                recordId=-1,
                changes=user_role.get_creation_changes()
            ))

        db_sess.commit()

        return user

    def delete(self, db_sess, actor):
        self.deleted = True

        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.deleted,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.User,
            recordId=self.id,
            changes=[]
        ))
        db_sess.commit()

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def check_permission(self, operation):
        return operation in self.get_operations()

    def add_access(self, db_sess, eventId, actor):
        access = PermissionAccess(userId=self.id, eventId=eventId)
        db_sess.add(access)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.added,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.PermissionAccess,
            recordId=-1,
            changes=access.get_creation_changes()
        ))

    def remove_access(self, db_sess, eventId, actor):
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
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.PermissionAccess,
            recordId=-1,
            changes=access.get_deletion_changes()
        ))

    def has_access(self, eventId):
        for item in self.access:
            if item.eventId == eventId:
                return True
        return False

    def add_role(self, db_sess, actor, roleId):
        existing = db_sess.query(UserRole).filter(UserRole.userId == self.id, UserRole.roleId == roleId).first()
        if existing:
            return False

        user_role = UserRole(userId=self.id, roleId=roleId)
        db_sess.add(user_role)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.added,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.UserRole,
            recordId=-1,
            changes=user_role.get_creation_changes()
        ))
        db_sess.commit()
        return True

    def remove_role(self, db_sess, actor, roleId):
        user_role: UserRole = db_sess.query(UserRole).filter(UserRole.userId == self.id, UserRole.roleId == roleId).first()
        if not user_role:
            return False

        db_sess.delete(user_role)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.deleted,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.UserRole,
            recordId=-1,
            changes=user_role.get_deletion_changes()
        ))
        db_sess.commit()
        return True

    def get_creation_changes(self):
        return [
            ("login", None, self.login),
            ("name", None, self.name),
            ("password", None, "***"),
        ]

    def get_roles_id(self):
        return list(map(lambda v: v.role.name, self.roles))

    def get_operations(self):
        operations = []
        for user_role in self.roles:
            for p in user_role.role.permissions:
                operations.append(p.operation.id)
        return operations

    def get_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "roles": self.get_roles_id(),
            "operations": self.get_operations(),
        }

    def get_dict_full(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "roles": self.get_roles_id(),
            "bossId": self.bossId,
            "deleted": self.deleted,
            "access": list(map(lambda v: v.eventId, self.access)),
            "operations": self.get_operations(),
        }


def get_datetime_now():
    return datetime.now(timezone.utc) + timedelta(hours=3)
