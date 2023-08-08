import sys


def add_user(login, password, name, roleId):
    add_parent_to_path()
    from data import db_session
    from data.user import User

    db_session.global_init("db/TicketSystem.db")
    user = User(login=login, name=name, roleId=roleId)
    user.set_password(password)

    session = db_session.create_session()
    session.add(user)
    session.commit()
    print("User added")


def add_parent_to_path():
    import os

    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if len(sys.argv) != 5:
    print("Add user: login password name roleId")
else:
    add_user(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
