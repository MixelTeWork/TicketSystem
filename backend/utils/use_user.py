from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy.orm import Session
from functools import wraps
from data.user import User


def use_user():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            db_sess: Session = kwargs["db_sess"]
            if not db_sess:
                return jsonify({"msg": "use_user: no db_sess"}), 500
            user: User = db_sess.query(User).filter(User.id == get_jwt_identity()).first()
            if not user:
                return jsonify({"msg": "User not found"}), 401
            return fn(*args, **kwargs, user=user)

        return decorator

    return wrapper
