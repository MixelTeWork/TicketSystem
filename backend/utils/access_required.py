from flask import abort

from bfs import create_permission_required_decorator
from data.user import User


@create_permission_required_decorator
def access_required(eventIdKey: str, kwargs: dict = None):
    if eventIdKey not in kwargs:
        abort(500, "permission_required: no eventId")

    user: User = kwargs["user"]
    eventId: int = kwargs[eventIdKey]

    return user.has_access(eventId)
