from flask import abort, jsonify
from flask_jwt_extended import get_jwt_identity, unset_jwt_cookies
from sqlalchemy.orm import Session
from functools import wraps
from data.user import User


def use_user():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            if "db_sess" not in kwargs:
                abort(500, "use_user: no db_sess")

            db_sess: Session = kwargs["db_sess"]
            jwt_identity = get_jwt_identity()
            if (not isinstance(jwt_identity, list) and not isinstance(jwt_identity, tuple)) or len(jwt_identity) != 2:
                response = jsonify({"msg": "The JWT has expired"})
                unset_jwt_cookies(response)
                return response, 401

            user: User = db_sess.query(User).filter(User.id == get_jwt_identity()[0]).first()
            if not user:
                return jsonify({"msg": "User not found"}), 401
            if user.password != jwt_identity[1]:
                response = jsonify({"msg": "The JWT has expired"})
                unset_jwt_cookies(response)
                return response, 401
            return fn(*args, **kwargs, user=user)

        return decorator

    return wrapper
