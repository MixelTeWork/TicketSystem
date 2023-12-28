from functools import wraps
from flask import abort
from data.user import User


def permission_required(operation, eventIdKey=None):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            user = None
            if "user" in kwargs:
                user: User = kwargs["user"]
            else:
                abort(500, "permission_required: no user")

            if not user.check_permission(operation[0]):
                abort(403)
            if eventIdKey is not None:
                if eventIdKey in kwargs:
                    if not user.has_access(kwargs[eventIdKey]):
                        abort(403)
                else:
                    abort(500, "permission_required: no eventId")

            return fn(*args, **kwargs)

        return decorator

    return wrapper
