import sys

from dotenv import load_dotenv

load_dotenv()
dev_mode = "dev" in sys.argv
storage_path = "storage" if dev_mode else "../../storage"

db_dev_path = storage_path + "/db/dev.db"
db_path = "ENV:DBPATH"
# db_path = "root:123@localhost:8081/default"
db_mysql = True
sql_echo = False
datetime_utc = True
allow_unsupported_for_update_clause = None

use_alembic = True
migrations_folder = "alembic"

log_info_path = storage_path + "/logs/log_info.csv"
log_requests_path = storage_path + "/logs/log_requests.csv"
log_errors_path = storage_path + "/logs/log_errors.log"
log_frontend_path = storage_path + "/logs/log_frontend.log"
log_dashboard_path = storage_path + "/logs/log_dashboard.csv"

jwt_key_file_path = storage_path + "/secret_key_jwt.txt"
images_folder = storage_path + "/images"

login_page_url = "/login"
api_url = "/api/"

blueprints_folder = "blueprints"
data_tables_folder = "data"
