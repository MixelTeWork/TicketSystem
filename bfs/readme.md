# base for flask server by Mixel Te

## requirements.txt
Python 3.9.5
```
flask==2.1.2
sqlalchemy==2.0.19
werkzeug==2.3.6
sqlalchemy_serializer==1.4.1
flask_jwt_extended==4.5.2
PyMySQL
```

## usage
copy `bfs_config.example.py` to project root as `bfs_config.py`

create files:

```py
# data/_operations.py
from bfs import OperationsBase


class Operations(OperationsBase):
    oper_id = ("oper_id", "Operation description")
    oper_id2 = ("oper_id2", "Operation description")
    ...
```
```py
# data/_roles.py
from bfs import RolesBase
from data._operations import Operations


class Roles(RolesBase):
    role_name = 2
    role_name2 = 3
    ...


Roles.ROLES = {
    Roles.role_name: {
        "name": "Role name",
        "operations": [
            Operations.oper_id,
            Operations.oper_id2,
        ]
    },
    Roles.role_name2: {
        "name": "Role name 2",
        "operations": [
            Operations.oper_id,
        ]
    },
}
```
```py
# data/_tables.py
from bfs import TablesBase


class Tables(TablesBase):
    TableName = "TableName"
    AnotherTableName = "AnotherTableName"
```
```py
# data/some_table.py
from bfs import SqlAlchemyBase, ObjMixin
from data._tables import Tables


class SomeTable(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.SomeTable
    ...

```
* `IdMixin` adds `id` column
* `ObjMixin` adds `id` and `deleted` columns

```py
# main.py
import sys
from bfs import AppConfig, create_app
from scripts.init_dev_values import init_dev_values


app, run = create_app(__name__, AppConfig(
    MESSAGE_TO_FRONTEND="",
    DEV_MODE="dev" in sys.argv,
    DELAY_MODE="delay" in sys.argv,
)
    .add_data_folder("FONTS_FOLDER", "fonts")
    .add_secret_key("API_SECRET_KEY", "secret_key_api.txt")
)

run(__name__ == "__main__", lambda: init_dev_values(True), port=5001)
```

#### csv header for requests log
```csv
reqid;ip;uid;asctime;method;url;level;message;code;json
```