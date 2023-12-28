import sys


def add_user(login, password, name, roleId):
    roleId = int(roleId)
    add_parent_to_path()
    from data import db_session
    from data.user import User
    from data.role import Role, Roles
    from data.user_role import UserRole

    db_session.global_init("dev" in sys.argv)
    session = db_session.create_session()
    user_admin = session.query(User).join(UserRole).where(UserRole.roleId == Roles.admin).first()
    existing = session.query(User).filter(User.login == login).first()
    if existing:
        print(f"User with login [{login}] already exist")
        return
    role = session.get(Role, roleId)
    if not role:
        print(f"Role with id [{roleId}] does not exist")
        return

    User.new(session, user_admin, login, name, password, [roleId])

    print("User added")


def add_parent_to_path():
    import os

    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if not (len(sys.argv) == 5 or (len(sys.argv) == 6 and sys.argv[-1] == "dev")):
    print("Add user: login password name roleId [dev]")
else:
    add_user(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
