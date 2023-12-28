from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from data.role import Roles
from data.user import User
from data.user_role import UserRole
from utils import get_json_values, permission_required, randstr, use_db_session, use_user


blueprint = Blueprint("managers", __name__)


@blueprint.route("/api/managers")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_managers)
def managers(db_sess: Session, user: User):
    users = db_sess.query(User).join(UserRole).where(User.deleted == False, UserRole.roleId == Roles.manager).all()
    return jsonify(list(map(lambda x: x.get_dict(), users))), 200


@blueprint.route("/api/manager", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_manager)
def add_managers(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (name, login), values_error = get_json_values(data, "name", "login")

    if values_error:
        return jsonify({"msg": values_error}), 400

    existing_user = db_sess.query(User).filter(User.login == login).first()
    if existing_user is not None:
        return jsonify({"msg": f"User with login {login} already exist"}), 400

    password = randstr(8)
    manager = User.new(db_sess, user, login, password, name, [Roles.manager])

    manager_json = manager.get_dict()
    manager_json["password"] = password

    return jsonify(manager_json), 200


@blueprint.route("/api/manager/<int:managerId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_manager)
def delete_manager(managerId, db_sess: Session, user: User):
    manager = db_sess.query(User).filter(User.deleted == False, User.id == managerId).first()
    if manager is None:
        return jsonify({"msg": f"User with 'userId={managerId}' not found"}), 400

    manager.delete(db_sess, user)

    return "", 200
