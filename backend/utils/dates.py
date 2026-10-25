from datetime import datetime, timedelta, timezone

MOSCOW_TIMEZONE = timezone(timedelta(hours=3))


def as_utc_naive(value: datetime) -> datetime:
    """Normalize an instant for SQL DATETIME; naive values already represent UTC."""
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo is not None else value


def as_moscow(value: datetime) -> datetime:
    """Convert a stored UTC instant to the application's fixed Moscow offset."""
    return as_utc_naive(value).replace(tzinfo=timezone.utc).astimezone(MOSCOW_TIMEZONE)


def moscow_day_utc(value: str, *, end_of_day: bool = False) -> datetime:
    """Return the inclusive beginning or end of a Moscow calendar day in SQL UTC."""
    date = datetime.strptime(value, "%Y-%m-%d")
    if end_of_day:
        date = date.replace(hour=23, minute=59, second=59, microsecond=999999)
    return as_utc_naive(date.replace(tzinfo=MOSCOW_TIMEZONE))
