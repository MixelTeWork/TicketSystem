from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict

from bafser import Constants, Log, ObjMixin, PublicError, SqlAlchemyBase, TruncateString, U
from sqlalchemy import JSON, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint, inspect, orm, select
from sqlalchemy import event as sa_event
from sqlalchemy.orm import Mapped, Session, UOWTransaction, mapped_column

from data._tables import Tables
from data.event import Event
from data.img import Image
from data.user import User

if TYPE_CHECKING:
    from data.ticket_category import TicketCategory
    from data.ticket_type_day import TicketTypeDay


class VariantDaysError(PublicError):
    code = "variant_days_immutable"
    status = 409


class VariantUnavailableError(PublicError):
    code = "variant_unavailable"
    status = 409


class CatalogOutdatedError(PublicError):
    code = "catalog_outdated"
    status = 409


class TicketTypeData(TypedDict):
    id: int
    name: str
    imageId: int | None
    pattern: dict[str, Any] | None
    price: int | None
    categoryId: int
    dayOffsets: list[int]
    validDates: list[str]
    quantity: int | None


class CatalogVariantData(TicketTypeData):
    deleted: bool
    available: bool


class TicketType(SqlAlchemyBase, ObjMixin):
    """A category's ticket variant with fixed allowed days and its own price, quota and design."""

    __tablename__ = Tables.TicketType
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("number >= 0", name="ticket_type_number_nonnegative"),
        CheckConstraint("price >= 0", name="ticket_type_price_nonnegative"),
        CheckConstraint("quantity >= 0", name="ticket_type_quantity_nonnegative"),
        UniqueConstraint("categoryId", "daysKey", name="uq_ticket_category_days"),
    )

    eventId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Event}.id"), nullable=False)
    name: Mapped[str] = mapped_column(TruncateString(64), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    categoryId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.TicketCategory}.id"), nullable=False)
    daysKey: Mapped[str] = mapped_column(String(256), nullable=False)
    imageId: Mapped[int | None] = mapped_column(Integer, ForeignKey(f"{Tables.Image}.id"), nullable=True, default=None)
    pattern: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True, default=None)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    event: Mapped[Event] = orm.relationship("Event", back_populates="ticket_types", init=False)
    image: Mapped[Image | None] = orm.relationship("data.img.Image", init=False)
    category: Mapped[TicketCategory] = orm.relationship("TicketCategory", back_populates="variants", init=False)
    days: Mapped[list[TicketTypeDay]] = orm.relationship("TicketTypeDay", back_populates="type", init=False, default_factory=list)

    @property
    def day_offsets(self) -> list[int]:
        return sorted(link.day.dayOffset for link in self.days)

    @property
    def valid_dates(self) -> list[str]:
        return [link.day.to_dict(only=("date",))["date"] for link in sorted(self.days, key=lambda link: link.day.dayOffset)]

    @property
    def available(self) -> bool:
        return not self.deleted and not self.category.deleted and not self.event.deleted and self.days_fit_period

    @property
    def days_fit_period(self) -> bool:
        offsets = self.day_offsets
        return bool(offsets) and all(offset < self.event.day_count for offset in offsets)

    def __repr__(self) -> str:
        return f"<TicketType> [{self.id}] {self.name}"

    @staticmethod
    def add(
        actor: User,
        event: Event,
        name: str,
        price: int | None,
        now: datetime,
        category: TicketCategory,
        dayOffsets: list[int],
        quantity: int | None = None,
    ) -> TicketType:
        """Stage an explicit category/day variant under the caller's Event lock."""
        event.require_for_update()
        db_sess = actor.db_sess
        from data.ticket_type_day import TicketTypeDay

        offsets = TicketType.normalize_offsets(dayOffsets)
        TicketType.validate_quantity(quantity)
        if any(offset >= event.day_count for offset in offsets):
            raise CatalogOutdatedError("Период мероприятия изменился. Обновите каталог")
        if category.eventId != event.id or category.deleted:
            raise VariantUnavailableError("Категория недоступна для этого мероприятия")
        key = ",".join(map(str, offsets))
        existing = TicketType.query(True, for_update=True, db_sess=db_sess).filter_by(categoryId=category.id, daysKey=key).first()
        if existing is not None:
            if not existing.deleted:
                raise VariantDaysError("Такая разновидность уже существует в категории")
            existing.restore(actor, commit=False, now=now, db_sess=db_sess)
            return existing

        available_days = {day.dayOffset: day for day in event.ensure_days()}
        ttype = TicketType(
            eventId=event.id, name=name, number=event.lastTypeNumber, price=price, quantity=quantity, daysKey=key, categoryId=category.id
        )
        ttype.category = category
        for offset in offsets:
            link = TicketTypeDay(typeId=ttype.id, eventDayId=available_days[offset].id)
            link.day = available_days[offset]
            ttype.days.append(link)
        db_sess.add(ttype)

        event.lastTypeNumber += 1

        Log.added(ttype, actor, now=now, commit=False)
        return ttype

    @staticmethod
    def all_for_event(eventId: int, *, db_sess: Session | None = None) -> list[TicketType]:
        """Return non-deleted ticket types for the event."""
        from data.ticket_type_day import TicketTypeDay

        return [
            variant
            for variant in TicketType.query(db_sess=db_sess)
            .filter(TicketType.eventId == eventId)
            .options(
                orm.joinedload(TicketType.category),
                orm.joinedload(TicketType.event),
                orm.selectinload(TicketType.days).joinedload(TicketTypeDay.day),
            )
            .all()
            if variant.available
        ]

    def update(
        self, actor: User, name: str, price: int | None, quantity: int | None | U.T = U, *, commit: bool = True, now: datetime | None = None
    ) -> None:
        """Update the name and price, optionally committing the audit log."""
        if U.defined(quantity):
            self.validate_quantity(quantity)
            self.quantity = quantity
        self.name = name
        self.price = price
        Log.updated(self, actor, now=now, commit=commit)

    def update_design(self, actor: User, pattern: dict[str, Any], image: Image | None = None) -> None:
        """Stage the design and its audit log in the caller's transaction."""
        if image is not None:
            previous = self._image_for_update(actor.db_sess)
            if previous is not None:
                previous.delete(actor, commit=False)
            self.imageId = image.id
            self.image = image
        self.pattern = pattern
        Log.updated(self, actor, commit=False)

    def _on_delete(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        img = self._image_for_update(db_sess)
        if img is not None:
            img.delete(actor, commit=False, now=now, db_sess=db_sess)
        return True

    def refresh_current_relations(self, event: Event) -> TicketType:
        """Refresh category and days under the caller's Event and variant locks."""
        from sqlalchemy.orm.attributes import set_committed_value

        from data.ticket_category import TicketCategory
        from data.ticket_type_day import TicketTypeDay

        session = event.db_sess
        category = TicketCategory.get(self.categoryId, includeDeleted=True, for_update=True, db_sess=session)
        # Shared current reads remain compatible with EventDay FK checks by
        # a scanner that already holds its Ticket lock.
        links = (
            session.query(TicketTypeDay)
            .filter_by(typeId=self.id)
            .options(orm.joinedload(TicketTypeDay.day))
            .populate_existing()
            .with_for_update(read=True)
            .all()
        )
        set_committed_value(self, "category", category)
        set_committed_value(self, "event", event)
        set_committed_value(self, "days", links)
        return self

    def _on_restore(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        from sqlalchemy.orm.attributes import set_committed_value

        from data.ticket_category import TicketCategory
        from data.ticket_type_day import TicketTypeDay

        category = TicketCategory.get(self.categoryId, includeDeleted=True, for_update=True, db_sess=db_sess)
        links = (
            db_sess.execute(
                select(TicketTypeDay)
                .where(TicketTypeDay.typeId == self.id)
                .options(orm.joinedload(TicketTypeDay.day))
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            .scalars()
            .all()
        )
        set_committed_value(self, "category", category)
        set_committed_value(self, "days", links)
        if not self.category or self.category.deleted or not self.days_fit_period:
            return False
        image = self._image_for_update(db_sess)
        if image is not None and image.deleted:
            if not image.restore(actor, commit=False, now=now, db_sess=db_sess):
                self.image = None
                self.imageId = None
                self.pattern = None
        return True

    def _image_for_update(self, db_sess: Session) -> Image | None:
        """Read the current image after the caller has locked this variant."""
        from sqlalchemy.orm.attributes import set_committed_value

        image = Image.get(self.imageId, includeDeleted=True, for_update=True, db_sess=db_sess) if self.imageId is not None else None
        set_committed_value(self, "image", image)
        return image

    def get_dict(self) -> TicketTypeData:
        return {
            **self.to_dict(only=("id", "name", "imageId", "pattern", "price", "categoryId", "quantity")),
            "dayOffsets": self.day_offsets,
            "validDates": self.valid_dates,
        }

    def get_catalog_dict(self) -> CatalogVariantData:
        return {**self.get_dict(), "deleted": self.deleted, "available": self.available}

    @staticmethod
    def normalize_offsets(offsets: list[int]) -> list[int]:
        if not isinstance(offsets, (list, tuple)) or not offsets or any(type(offset) is not int or offset < 0 for offset in offsets):
            raise PublicError("Нужен непустой набор смещений дней")
        if len(set(offsets)) != len(offsets):
            raise VariantDaysError("Дни разновидности не должны повторяться")
        return sorted(offsets)

    @staticmethod
    def validate_quantity(quantity: int | None) -> None:
        if quantity is not None and (type(quantity) is not int or not 0 <= quantity <= Constants.INT32_MAX):
            raise PublicError("Количество должно быть неотрицательным целым числом")


@sa_event.listens_for(Session, "before_flush")
def _validate_variants(session: Session, flush_context: UOWTransaction, instances: Sequence[object] | None) -> None:
    """Validate explicitly assigned catalog relationships and their immutability."""
    from data.event_day import EventDay
    from data.ticket_type_day import TicketTypeDay

    for item in list(session.dirty):
        if isinstance(item, EventDay) and any(inspect(item).attrs[key].history.has_changes() for key in ("eventId", "dayOffset")):
            raise VariantDaysError("Смещение и мероприятие дня неизменяемы")
        if isinstance(item, TicketTypeDay) and any(inspect(item).attrs[key].history.has_changes() for key in ("typeId", "eventDayId")):
            raise VariantDaysError("Набор дней разновидности неизменяем")
        if isinstance(item, TicketType):
            state = inspect(item)
            if (
                state.attrs.daysKey.history.has_changes()
                or state.attrs.categoryId.history.has_changes()
                or state.attrs.eventId.history.has_changes()
                or state.attrs.days.history.has_changes()
            ):
                raise VariantDaysError("Набор дней и категория разновидности неизменяемы")
    for item in session.deleted:
        if isinstance(item, TicketTypeDay):
            raise VariantDaysError("Набор дней разновидности неизменяем")
    for item in list(session.new):
        if isinstance(item, TicketTypeDay):
            parent = item.type
            if parent is None or parent not in session.new or not any(link is item for link in parent.days):
                raise VariantDaysError("Набор дней созданной разновидности неизменяем")
        if isinstance(item, TicketType):
            if item.category.eventId != item.eventId:
                raise ValueError("Категория другого мероприятия")
            offsets = sorted(link.day.dayOffset for link in item.days)
            if not offsets or item.daysKey != ",".join(map(str, offsets)):
                raise VariantDaysError("Ключ набора дней не соответствует связям")
            for link in item.days:
                if link.day.eventId != item.eventId:
                    raise ValueError("День другого мероприятия")
