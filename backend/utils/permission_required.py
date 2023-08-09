from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy.orm import Session
from data.user import User
from functools import wraps


def permission_required(permission):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            if "user" in kwargs:
                user: User = kwargs["user"]
            else:
                if "db_sess" not in kwargs:
                    return jsonify({"msg": "use_user: no db_sess"}), 500

                db_sess: Session = kwargs["db_sess"]
                user: User = db_sess.query(User).filter(User.id == get_jwt_identity()).first()
                if not user:
                    return jsonify({"msg": "User not found"}), 401

            if not user.check_permission(permission[0]):
                return jsonify({"msg": "No permission"}), 403
            return fn(*args, **kwargs)

        return decorator

    return wrapper
