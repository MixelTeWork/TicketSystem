from typing import Literal

from bafser import (
    JsonObj,
    Log,
    TJson,
    doc_api,
    get_json_list_from_req,
    jsonify_list,
    protected_route,
    randstr,
    response_msg,
    response_not_found,
)
from flask import Blueprint, jsonify

from data._operations import Operations
from data._roles import Roles
from data.event import Event
from data.user import StaffData, User, UserData, UserWithPasswordData
from utils import access_required

blueprint = Blueprint("staff", __name__)


class NewStaffJson(JsonObj):
    name: str
    login: str
    role: Literal["clerk", "usher"]


@blueprint.route("/api/staff")
@doc_api(res=list[StaffData], desc="Сотрудники")
@protected_route(perms=Operations.page_staff)
def staff():
    user = User.current
    users = User.all_staff_for_manager(user)
    allowed = {event.id for event in Event.all_for_user(user)}
    return jsonify([staff.get_dict_staff(allowed) for staff in users])


@blueprint.post("/api/staff/<int:staffId>/access")
@doc_api(req=list[int], res=StaffData, desc="Изменить доступ сотрудника к мероприятиям")
@protected_route(perms=Operations.change_staff_event)
def change_staff_access(staffId):
    user = User.current
    staff = User.get(staffId)
    if staff is None:
        return response_not_found("user", staffId)
    selected = get_json_list_from_req(int)
    try:
        return jsonify(user.set_staff_access(staff, selected))
    except PermissionError as error:
        return response_msg(str(error), 403)


@blueprint.post("/api/staff")
@doc_api(req=NewStaffJson, res=UserWithPasswordData, desc="Добавить сотрудника")
@protected_route(perms=Operations.add_staff)
def add_staff():
    user = User.current
    data = NewStaffJson.get_from_req()
    name, login = data.name, data.login

    existing_user = User.get_by_login(login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    role = Roles.usher if data.role == "usher" else Roles.clerk
    staff = User.new(user, login, password, name, [role], user.id)

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
    users = User.all_staff_for_event(user, eventId)
    return jsonify_list(users)


@blueprint.post("/api/events/<int:eventId>/staff")
@doc_api(req=list[int], res=list[UserData], desc="Изменить сотрудников события")
@protected_route(perms=Operations.change_staff_event)
@access_required("eventId")
def change_staff_event(eventId):
    user = User.current
    new_staff = get_json_list_from_req(int)

    user.set_staff_event_access(eventId, new_staff)

    staff = User.all_staff_for_event(user, eventId)
    return jsonify_list(staff)
