from sqlalchemy import ForeignKey, orm, Column, Integer
from sqlalchemy.orm import Session

from data._roles import Roles
from data.permission_access import PermissionAccess
from bfs import UserBase


class User(UserBase):
    bossId = Column(Integer, ForeignKey("User.id"), nullable=True)

    boss = orm.relationship("User")
    access = orm.relationship("PermissionAccess")

    @classmethod
    def new(cls, creator: "User", login: str, password: str, name: str, roles: list[int], bossId: int = None, db_sess: Session = None) -> "User":
        return super().new(creator, login, password, name, roles, db_sess, bossId=bossId)

    @staticmethod
    def _new(db_sess: Session, user_kwargs: dict, bossId: int = None):
        user = User(**user_kwargs, bossId=bossId)
        changes = [] if bossId is None else [("bossId", bossId)]
        return user, changes

    @staticmethod
    def all_managers(db_sess: Session):
        return User.all_of_role(db_sess, Roles.manager)

    @staticmethod
    def all_user_staff(boss: "User"):
        db_sess = Session.object_session(boss)
        return User.query(db_sess).filter(User.bossId == boss.id).all()

    @staticmethod
    def all_event_staff(boss: "User", eventId: int):
        db_sess = Session.object_session(boss)
        return User.query(db_sess).filter(User.bossId == boss.id, User.access.any(PermissionAccess.eventId == eventId)).all()

    @staticmethod
    def all_event_access(db_sess: Session, eventId: int):
        return User.query(db_sess).filter(User.access.any(PermissionAccess.eventId == eventId)).all()

    def add_access(self, eventId: int, actor: "User", commit=True):
        PermissionAccess.new(actor, self.id, eventId, commit)

    def remove_access(self, eventId: int, actor: "User", commit=True):
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
            "access": list(map(lambda v: v.eventId, self.access)),
            "operations": self.get_operations(),
        }
