from collections.abc import Callable
from functools import wraps
from typing import TypeVar

from flask import abort
from typing_extensions import ParamSpec

from data.user import User

P = ParamSpec("P")
R = TypeVar("R")


def access_required(eventIdKey: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(fn: Callable[P, R]) -> Callable[P, R]:
        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            event_id = kwargs.get(eventIdKey)
            if not isinstance(event_id, int):
                abort(500, "access_required: no eventId")
            if not User.current.has_access(event_id):
                abort(403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
