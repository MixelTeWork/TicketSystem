import sys


def change_user_password(login, password):
    add_parent_to_path()
    from data import db_session
    from data.user import User

    db_session.global_init("db/TicketSystem.db" if "dev" in sys.argv else None)
    session = db_session.create_session()
    user: User = session.query(User).filter(User.login == login).first()
    if user is None:
        print("User does not exist")
        return
    user.set_password(password)
    session.commit()
    print("Password changed")


def add_parent_to_path():
    import os

    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


if len(sys.argv) != 3:
    print("Change user password: login new_password")
else:
    change_user_password(sys.argv[1], sys.argv[2])
