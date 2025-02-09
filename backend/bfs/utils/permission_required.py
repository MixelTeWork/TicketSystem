from functools import wraps
from typing import Callable, TypeVar
from flask import abort

TCheckPermissionFn = TypeVar("TCheckPermissionFn", bound=Callable)


def create_permission_required_decorator(check_permission: TCheckPermissionFn):
    def permission_required(*args1, **kwargs1):
        def wrapper(fn):
            @wraps(fn)
            def decorator(*args2, **kwargs2):
                if "db_sess" not in kwargs2:
                    abort(500, "permission_required: no db_sess")
                if "user" not in kwargs2:
                    abort(500, "permission_required: no user")

                kwargs1["kwargs"] = kwargs2
                if not check_permission(*args1, **kwargs1):
                    abort(403)

                return fn(*args2, **kwargs2)
            return decorator
        return wrapper
    r: TCheckPermissionFn = permission_required
    return r


@create_permission_required_decorator
def permission_required(operation: tuple[str, str], kwargs: dict = None):
    from .. import UserBase
    # db_sess: Session = kwargs["db_sess"]
    user: UserBase = kwargs["user"]

    return user.check_permission(operation)
