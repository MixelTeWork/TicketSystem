from bafser import (
    Log,
    TJson,
    doc_api,
    get_json_list_from_req,
    get_json_values_from_req,
    jsonify_list,
    protected_route,
    randstr,
    response_msg,
    response_not_found,
)
from flask import Blueprint

from data._operations import Operations
from data._roles import Roles
from data.user import User, UserData, UserWithPasswordData
from utils import access_required

blueprint = Blueprint("staff", __name__)


@blueprint.route("/api/staff")
@doc_api(res=list[UserData], desc="Сотрудники")
@protected_route(perms=Operations.page_staff)
def staff():
    user = User.current
    users = User.all_user_staff(user)
    return jsonify_list(users)


@blueprint.post("/api/staff")
@doc_api(req=TJson["name", str, "login", str], res=UserWithPasswordData, desc="Добавить сотрудника")
@protected_route(perms=Operations.add_staff)
def add_staff():
    user = User.current
    name, login = get_json_values_from_req(("name", str), ("login", str))

    existing_user = User.get_by_login(login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    staff = User.new(user, login, password, name, [Roles.clerk], user.id)

    staff_json = staff.get_dict()
    staff_json["password"] = password

    return staff_json


@blueprint.delete("/api/staff/<int:staffId>")
@doc_api(res=TJson["msg", str], desc="Удалить сотрудника")
@protected_route(perms=Operations.delete_staff)
def delete_staff(staffId):
    user = User.current
    staff = User.get(staffId)
    if staff is None:
        return response_not_found("user", staffId)

    if staff.bossId != user.id:
        return response_msg(f"User with 'userId={staffId}' is not your staff", 403)

    staff.delete(user)

    return response_msg("ok")


@blueprint.post("/api/staff/<int:staffId>/reset_password")
@doc_api(res=UserWithPasswordData, desc="Сбросить пароль сотрудника")
@protected_route(perms=Operations.change_staff)
def reset_password(staffId):
    user = User.current
    staff = User.get(staffId)
    if staff is None:
        return response_not_found("user", staffId)

    if staff.bossId != user.id:
        return response_msg(f"User with 'userId={staffId}' is not your staff", 403)

    password = randstr(8)
    staff.set_password(password)
    staff_json = staff.get_dict()
    staff_json["password"] = password

    Log.updated(staff, user)

    return staff_json


@blueprint.route("/api/events/<int:eventId>/staff")
@doc_api(res=list[UserData], desc="Сотрудники события")
@protected_route(perms=Operations.get_staff_event)
@access_required("eventId")
def staff_event(eventId):
    user = User.current
    users = User.all_event_staff(user, eventId)
    return jsonify_list(users)


@blueprint.post("/api/events/<int:eventId>/staff")
@doc_api(req=list[int], res=list[UserData], desc="Изменить сотрудников события")
@protected_route(perms=Operations.change_staff_event)
@access_required("eventId")
def change_staff_event(eventId):
    user = User.current
    new_staff = get_json_list_from_req(int)

    staff = User.all_user_staff(user)
    for s in staff:
        has_access = s.has_access(eventId)
        if s.id in new_staff:
            if not has_access:
                s.add_access(eventId, user, commit=False)
        else:
            if has_access:
                s.remove_access(eventId, user, commit=False)

    user.db_sess.commit()

    staff = User.all_event_staff(user, eventId)
    return jsonify_list(staff)
