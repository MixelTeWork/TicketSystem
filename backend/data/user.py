from __future__ import annotations

from typing import TypedDict

from bafser import UserBase
from sqlalchemy import ForeignKey, Integer, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._roles import Roles
from data.permission_access import PermissionAccess


class UserData(TypedDict):
    id: int
    name: str
    login: str
    roles: list[str]
    operations: list[str]


class UserWithPasswordData(UserData):
    password: str


class FullUserData(TypedDict):
    id: int
    name: str
    login: str
    roles: list[tuple[int, str]]
    operations: list[str]
    bossId: int | None
    deleted: bool
    access: list[int]


class User(UserBase):
    bossId: Mapped[int | None] = mapped_column(Integer, ForeignKey("User.id"), nullable=True, default=None)

    boss: Mapped[User | None] = orm.relationship("User", init=False)
    access: Mapped[list[PermissionAccess]] = orm.relationship("PermissionAccess", init=False)

    @classmethod
    def new(cls, creator: User, login: str, password: str, name: str, roles: list[int], bossId: int | None = None, db_sess: Session = None) -> User:
        return super().new(creator, login, password, name, roles, db_sess=db_sess, bossId=bossId)

    @classmethod
    def _new(cls, db_sess: Session, user_kwargs: dict, bossId: int | None = None):
        return cls(**user_kwargs, bossId=bossId)

    @staticmethod
    def all_managers(*, db_sess: Session | None = None):
        return User.all_of_role(Roles.manager, db_sess=db_sess)

    @staticmethod
    def all_user_staff(boss: User):
        return User.query(db_sess=boss.get_session()).filter(User.bossId == boss.id).all()

    @staticmethod
    def all_event_staff(boss: User, eventId: int):
        return User.query(db_sess=boss.get_session()).filter(User.bossId == boss.id, User.access.any(PermissionAccess.eventId == eventId)).all()

    @staticmethod
    def all_event_access(eventId: int, *, db_sess: Session | None = None):
        return User.query(db_sess=db_sess).filter(User.access.any(PermissionAccess.eventId == eventId)).all()

    def add_access(self, eventId: int, actor: User, commit=True):
        PermissionAccess.new(actor, self.id, eventId, commit)

    def remove_access(self, eventId: int, actor: User, commit=True):
        for v in self.access:
            item: PermissionAccess = v
            if item.eventId == eventId:
                item.delete(actor, commit=commit)
                return

    def has_access(self, eventId: int):
        for v in self.access:
            item: PermissionAccess = v
            if item.eventId == eventId:
                return True
        return False

    def get_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "roles": self.get_roles(),
            "operations": self.get_operations(),
        }

    def get_dict_full(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "roles": self.get_roles(),
            "bossId": self.bossId,
            "deleted": self.deleted,
            "access": [v.eventId for v in self.access],
            "operations": self.get_operations(),
        }
