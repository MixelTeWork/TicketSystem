import sys
import os


def init_db_values(dev=False, cmd=False):
    print(f"init_db_values {dev=}")
    if cmd:
        add_root_to_path()
    if dev:
        import bfs_config
        if not os.path.exists(bfs_config.db_dev_path):
            os.makedirs(os.path.dirname(bfs_config.db_dev_path), exist_ok=True)

    from bfs import db_session, Role, UserBase

    db_session.global_init(dev)
    db_sess = db_session.create_session()

    Role.update_roles_permissions(db_sess)
    UserBase._create_admin(db_sess)

    db_sess.close()


def add_root_to_path():
    current = os.path.dirname(os.path.realpath(__file__))
    root = os.path.dirname(os.path.dirname(current))
    sys.path.append(root)


if __name__ == "__main__":
    init_db_values("dev" in sys.argv, True)
