from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from data.event import Event
    from data.user import User

def single_day_variant(
    actor: User, event: Event, name: str, price: int | None, now: datetime, *, quantity: int | None = None
) -> TicketType:
    """Build an explicit category/[0] graph under the caller's Event lock."""
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType

    category = TicketCategory.add(actor, event, name, now)
    return TicketType.add(actor, event, name, price, now, category=category, dayOffsets=[0], quantity=quantity)
