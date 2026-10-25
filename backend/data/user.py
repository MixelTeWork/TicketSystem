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


class StaffData(UserData):
    access: list[int]


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
    def new(
        cls, creator: User, login: str, password: str, name: str, roles: list[int], bossId: int | None = None, db_sess: Session | None = None
    ) -> User:
        """Create a user with roles and an optional manager, committing the audit log."""
        return super().new(creator, login, password, name, roles, db_sess=db_sess, bossId=bossId)

    @classmethod
    def _new(cls, db_sess: Session, user_kwargs: dict, bossId: int | None = None) -> User:
        return cls(**user_kwargs, bossId=bossId)

    @staticmethod
    def all_managers(*, db_sess: Session | None = None) -> list[User]:
        """Return non-deleted users with the manager role."""
        return User.all_of_role(Roles.manager, db_sess=db_sess)

    @staticmethod
    def all_staff_for_manager(boss: User) -> list[User]:
        """Return non-deleted staff belonging to the manager."""
        return User.query(db_sess=boss.get_session()).filter(User.bossId == boss.id).options(orm.selectinload(User.access)).all()

    @staticmethod
    def all_staff_for_event(boss: User, eventId: int) -> list[User]:
        """Return the manager's non-deleted staff with access to the event."""
        return (
            User.query(db_sess=boss.get_session())
            .filter(
                User.bossId == boss.id,
                User.access.any(PermissionAccess.eventId == eventId),
            )
            .all()
        )

    @staticmethod
    def all_with_event_access(eventId: int, *, db_sess: Session | None = None) -> list[User]:
        """Return non-deleted users with access to the event."""
        return User.query(db_sess=db_sess).filter(User.access.any(PermissionAccess.eventId == eventId)).all()

    def add_access(self, eventId: int, actor: User, commit=True):
        """Grant event access, optionally committing the audit log."""
        PermissionAccess.new(actor, self.id, eventId, commit)

    def remove_access(self, eventId: int, actor: User, commit=True):
        """Revoke existing event access, optionally committing the audit log."""
        for item in self.access:
            if item.eventId == eventId:
                item.delete(actor, commit=commit)
                return

    def has_access(self, eventId: int) -> bool:
        """Check whether the user has an access grant for the event."""
        return any(item.eventId == eventId for item in self.access)

    def set_staff_event_access(self, eventId: int, staff_ids: list[int]) -> None:
        """Replace event access for this manager's staff and commit the audit logs."""
        selected_ids = set(staff_ids)
        for staff in User.all_staff_for_manager(self):
            selected = staff.id in selected_ids
            has_access = staff.has_access(eventId)
            if selected and not has_access:
                staff.add_access(eventId, self, commit=False)
            elif has_access and not selected:
                staff.remove_access(eventId, self, commit=False)
        self.db_sess.commit()

    def set_staff_access(self, staff: User, event_ids: list[int]) -> StaffData:
        """Replace managed grants atomically, preserving grants outside this manager's scope."""
        from data.event import Event

        if staff.bossId != self.id:
            raise PermissionError("Это не ваш сотрудник")
        selected = set(event_ids)
        allowed = {event.id for event in Event.all_for_user(self)}
        if not selected.issubset(allowed):
            raise PermissionError("Нет доступа к мероприятию")
        current = {grant.eventId for grant in staff.access}
        for event_id in selected - current:
            staff.add_access(event_id, self, commit=False)
        for event_id in (current & allowed) - selected:
            staff.remove_access(event_id, self, commit=False)
        self.get_session().commit()
        return staff.get_dict_staff(allowed)

    def get_dict_staff(self, allowed_event_ids: set[int]) -> StaffData:
        return {**self.get_dict(), "access": sorted(grant.eventId for grant in self.access if grant.eventId in allowed_event_ids)}

    def get_dict(self) -> UserData:
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "roles": self.get_roles_names(),
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
