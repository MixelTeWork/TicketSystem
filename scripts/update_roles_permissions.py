import sys
import os


def update_roles_permissions():
    add_parent_to_path()
    from data import db_session
    from data.role import Role

    db_session.global_init("dev" in sys.argv)
    session = db_session.create_session()
    Role.update_roles_permissions(session)


def add_parent_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    parent = os.path.dirname(current)
    sys.path.append(parent)


update_roles_permissions()
