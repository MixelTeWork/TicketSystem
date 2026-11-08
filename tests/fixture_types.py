"""Shared argument types for test fixtures and their callbacks."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, TypeAlias, TypedDict

if TYPE_CHECKING:
    from datetime import datetime

    from flask.testing import FlaskClient

    from data.event import Event, EventData
    from data.ticket import Ticket
    from data.ticket_category import TicketCatalogData, TicketCategoryData
    from data.ticket_type import CatalogVariantData, TicketType
    from data.user import User


JsonValue: TypeAlias = "None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]"
TicketScenario: TypeAlias = "tuple[Event, TicketType, Ticket]"
ManagerContext: TypeAlias = "tuple[FlaskClient, User, Event, TicketType]"
ManagerAndEvent: TypeAlias = "tuple[FlaskClient, User, Event]"
ScannerContext: TypeAlias = "tuple[User, User, Event, TicketType, Ticket]"
TicketPageContext: TypeAlias = "tuple[FlaskClient, User, Event, TicketType, TicketType, list[int]]"
CatalogContext: TypeAlias = "tuple[FlaskClient, EventData, TicketCatalogData]"
MultidayContext: TypeAlias = "tuple[FlaskClient, EventData, TicketCategoryData, dict[str, CatalogVariantData]]"
DesignContext: TypeAlias = "tuple[FlaskClient, int, int, dict[str, JsonValue]]"


class UserFactory(Protocol):
    def __call__(self, login: str, name: str, role: int, boss_id: int | None = None, password: str = "password") -> User: ...


class Login(Protocol):
    def __call__(self, username: str, password: str = "password") -> FlaskClient: ...


class IssuedTicket(TypedDict):
    id: int
    createdDate: datetime
    createdById: int
    eventId: int
    typeId: int
    code: str
    authOnPltf: bool
    deleted: bool
    merchIssuedAt: datetime | None
    merchIssuedById: int | None
    offsets: list[int]


class IssuedData(TypedDict):
    event: int
    types: dict[str, int]
    tickets: list[IssuedTicket]
    days: dict[int, int]
    checkin: int
    link: int
