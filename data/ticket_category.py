from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase, TruncateString, get_db_session
from sqlalchemy import ForeignKey, Integer, orm, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.ticket_type import CatalogVariantData
from data.user import User

if TYPE_CHECKING:
    from data.event import Event
    from data.ticket_type import TicketType


class TicketCategoryData(TypedDict):
    id: int
    name: str
    variants: list[CatalogVariantData]


class TicketCatalogData(TypedDict):
    eventId: int
    categories: list[TicketCategoryData]


class TicketCategory(SqlAlchemyBase, ObjMixin):
    """An event's named group of ticket variants with different allowed days."""

    __tablename__ = Tables.TicketCategory

    eventId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Event}.id"), nullable=False)
    name: Mapped[str] = mapped_column(TruncateString(64), nullable=False)

    event: Mapped[Event] = orm.relationship("Event", back_populates="categories", init=False)
    variants: Mapped[list[TicketType]] = orm.relationship("TicketType", back_populates="category", init=False, default_factory=list)

    @staticmethod
    def add(actor: User, event: Event, name: str, now: datetime) -> TicketCategory:
        event.require_for_update()
        category = TicketCategory(eventId=event.id, name=name)
        actor.db_sess.add(category)
        Log.added(category, actor, now=now, commit=False)
        return category

    def update(self, actor: User, name: str, *, commit: bool = True, now: datetime | None = None) -> None:
        self.name = name
        Log.updated(self, actor, now=now, commit=commit)

    def _on_delete(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        from sqlalchemy.orm.attributes import set_committed_value

        from data.ticket_type import TicketType

        variants = (
            db_sess.execute(select(TicketType).where(TicketType.categoryId == self.id).with_for_update().execution_options(populate_existing=True))
            .scalars()
            .all()
        )
        set_committed_value(self, "variants", variants)
        for variant in variants:
            if not variant.deleted:
                variant.delete(actor, commit=False, now=now, db_sess=db_sess)
        return True

    def get_dict(self) -> TicketCategoryData:
        return {
            "id": self.id,
            "name": self.name,
            "variants": [variant.get_catalog_dict() for variant in sorted(self.variants, key=lambda item: item.number)],
        }

    @staticmethod
    def catalog_for_event(eventId: int, *, db_sess: Session | None = None) -> TicketCatalogData:
        session = db_sess if db_sess is not None else get_db_session()
        from data.ticket_type import TicketType
        from data.ticket_type_day import TicketTypeDay

        categories = (
            TicketCategory.query(db_sess=session)
            .filter(TicketCategory.eventId == eventId)
            .options(
                orm.selectinload(TicketCategory.variants).selectinload(TicketType.days).joinedload(TicketTypeDay.day),
                orm.selectinload(TicketCategory.variants).joinedload(TicketType.event),
            )
            .order_by(TicketCategory.id)
            .all()
        )
        return {"eventId": eventId, "categories": [category.get_dict() for category in categories]}
