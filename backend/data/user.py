from typing import Union
from sqlalchemy import DefaultClause, ForeignKey, orm, Column, Integer, String, Boolean
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin
from werkzeug.security import generate_password_hash, check_password_hash

from data.get_datetime_now import get_datetime_now
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
    def new(creator: "User", login: str, password: str, name: str, roles: list[int], bossId: int = None, db_sess: Session = None):
        db_sess = db_sess if db_sess else Session.object_session(creator)
        user = User(login=login, name=name, bossId=bossId)
        user.set_password(password)
        db_sess.add(user)

        now = get_datetime_now()
        log = Log(
            date=now,
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.User,
            recordId=-1,
            changes=[
                ("login", None, user.login),
                ("name", None, user.name),
                ("password", None, "***"),
            ]
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
                userId=creator.id,
                userName=creator.name,
                tableName=Tables.UserRole,
                recordId=-1,
                changes=user_role.get_creation_changes()
            ))

        db_sess.commit()

        return user

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        user = db_sess.get(User, id)
        if user is None or (not includeDeleted and user.deleted):
            return None
        return user

    @staticmethod
    def get_by_login(db_sess: Session, login: str, includeDeleted=False):
        user = db_sess.query(User).filter(User.login == login)
        if not includeDeleted:
            user = user.filter(User.deleted == False)
        return user.first()

    @staticmethod
    def all_managers(db_sess: Session):
        from data.role import Roles
        users = db_sess.query(User).join(UserRole).where(User.deleted == False, UserRole.roleId == Roles.manager).all()
        return users

    @staticmethod
    def all_user_staff(boss: "User"):
        db_sess = Session.object_session(boss)
        users = db_sess.query(User).filter(User.deleted == False, User.bossId == boss.id).all()
        return users

    @staticmethod
    def all_event_staff(boss: "User", eventId: int):
        db_sess = Session.object_session(boss)
        users = db_sess.query(User).filter(User.deleted == False, User.bossId == boss.id, User.access.any(PermissionAccess.eventId == eventId)).all()
        return users

    @staticmethod
    def all_event_access(db_sess: Session, eventId: int):
        users = db_sess.query(User).filter(User.deleted == False, User.access.any(PermissionAccess.eventId == eventId)).all()
        return users

    def update_password(self, actor: "User", password: str):
        db_sess = Session.object_session(self)
        self.set_password(password)

        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.updated,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.User,
            recordId=self.id,
            changes=[("password", "***", "***")]
        ))
        db_sess.commit()

    def update_name(self, actor: "User", name: str):
        db_sess = Session.object_session(self)
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.updated,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.User,
            recordId=self.id,
            changes=[("name", self.name, name)]
        ))

        self.name = name
        db_sess.commit()

    def delete(self, actor: "User"):
        db_sess = Session.object_session(self)
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

    def set_password(self, password: str):
        self.password = generate_password_hash(password)

    def check_password(self, password: str):
        return check_password_hash(self.password, password)

    def check_permission(self, operation: str):
        return operation in self.get_operations()

    def add_access(self, eventId: int, actor: "User"):
        db_sess = Session.object_session(self)

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

    def remove_access(self, eventId: int, actor: "User"):
        db_sess = Session.object_session(self)

        access: Union[PermissionAccess, None] = None
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

    def has_access(self, eventId: int):
        for item in self.access:
            if item.eventId == eventId:
                return True
        return False

    def add_role(self, actor: "User", roleId: int):
        db_sess = Session.object_session(self)
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

    def remove_role(self, actor: "User", roleId: int):
        db_sess = Session.object_session(self)
        user_role = db_sess.query(UserRole).filter(UserRole.userId == self.id, UserRole.roleId == roleId).first()
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
