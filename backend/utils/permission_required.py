from flask import jsonify
from data.user import User
from functools import wraps


def permission_required(permission):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            user: User = kwargs["user"]
            if not user:
                return jsonify({"msg": "permission_required: no user"}), 500

            if not user.check_permission(permission[0]):
                return jsonify({"msg": "No permission"}), 403

            return fn(*args, **kwargs)

        return decorator

    return wrapper
