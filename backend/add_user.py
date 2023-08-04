import sys


def add_user(login, password, name):
    from data import db_session
    from data.user import User

    db_session.global_init("db/TicketSystem.db")
    user = User(login=login, name=name)
    user.set_password(password)

    session = db_session.create_session()
    session.add(user)
    session.commit()
    print("User added")


if (len(sys.argv) != 4):
    print("Add user: login password name")
else:
    add_user(sys.argv[1], sys.argv[2] ,sys.argv[3])
