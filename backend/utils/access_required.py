from functools import wraps

from flask import abort

from data.user import User


def access_required(eventIdKey: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if eventIdKey not in kwargs:
                abort(500, "access_required: no eventId")
            if not User.current.has_access(kwargs[eventIdKey]):
                abort(403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
