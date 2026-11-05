from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from flask import abort

from data.user import User

P = ParamSpec("P")
R = TypeVar("R")


def access_required_by_eventId(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        event_id = kwargs.get("eventId")
        if not isinstance(event_id, int):
            abort(500, "access_required: no eventId")
        if not User.current.has_access(event_id):
            abort(403)
        return fn(*args, **kwargs)

    return wrapper
