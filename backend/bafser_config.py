import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parent
load_dotenv(PROJECT_DIR / ".env", override=False)
dev_mode = "dev" in sys.argv

storage_override = os.environ.get("TICKETSYSTEM_STORAGE_DIR")
if storage_override is None:
    if not dev_mode:
        raise ValueError("Set TICKETSYSTEM_STORAGE_DIR to the absolute persistent storage directory")
    STORAGE_DIR = PROJECT_DIR / "storage"
else:
    if not storage_override.strip():
        raise ValueError("TICKETSYSTEM_STORAGE_DIR must not be empty")
    STORAGE_DIR = Path(storage_override)
    if not STORAGE_DIR.is_absolute():
        raise ValueError("TICKETSYSTEM_STORAGE_DIR must be an absolute path")
    STORAGE_DIR = STORAGE_DIR.resolve()
if not dev_mode and "--setup" not in sys.argv and not STORAGE_DIR.is_dir():
    raise ValueError("The configured persistent storage directory is missing; run setup before starting workers")
storage_path = str(STORAGE_DIR)

db_dev_path = storage_path + "/db/dev.db"
db_path = "ENV:DBPATH"
db_mysql = True
sql_echo = False
datetime_utc = True
allow_unsupported_for_update_clause = None

use_alembic = True
migrations_folder = str(PROJECT_DIR / "alembic")
frontend_folder = str(PROJECT_DIR / "build")

log_info_path = storage_path + "/logs/log_info.csv"
log_requests_path = storage_path + "/logs/log_requests.csv"
log_errors_path = storage_path + "/logs/log_errors.log"
log_frontend_path = storage_path + "/logs/log_frontend.log"
log_dashboard_path = storage_path + "/logs/log_dashboard.csv"

jwt_key_file_path = storage_path + "/secret_key_jwt.txt"
images_folder = storage_path + "/images"

login_page_url = "/login"
api_url = "/api/"

blueprints_package = "blueprints"
data_tables_package = "data"
