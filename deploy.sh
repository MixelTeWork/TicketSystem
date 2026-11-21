#!/usr/bin/env bash
set -euo pipefail

# Размещение:
#   ~/ticketsystem/deploy.sh       — этот файл
#   ~/ticketsystem/.env            — конфигурация приложения (не в Git)
#   ~/ticketsystem/virtualenv.pyz  — virtualenv
#   ~/ticketsystem/storage/        — постоянные данные
#   ~/ticketsystem/releases/       — релизы
#   ~/public_html/index.wsgi       — активный WSGI entrypoint
#
#   cd ~/ticketsystem
#   chmod +x deploy.sh
#
# Запуск: bash ~/ticketsystem/deploy.sh
# Необязательный файл ~/ticketsystem/.deploy.conf:
#   PYTHON_BIN="python3.10"
#   DEPLOY_HEALTH_URL="https://example.com/"
#
# Миграции/инициализация БД выполняются штатным main.py с --setup
# ДО переключения WSGI. Отдельный миграционный скрипт не требуется.

# Путь вычисляется по расположению deploy.sh, не зависит от текущего каталога.
BASE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
USERDIR="$(dirname -- "$BASE")"
PUBLIC="$USERDIR/public_html"

REPO="MixelTeWork/TicketSystem"
BRANCH="gh-pages"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ -f "$BASE/.deploy.conf" ]]; then
    # Доверенный локальный shell-файл; не хранить секреты в Git.
    # shellcheck source=/dev/null
    source "$BASE/.deploy.conf"
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-}"

# Setup и Apache используют один постоянный storage независимо от cwd/.env.
# Значение также встраивается в WSGI: окружение deploy.sh не наследуется Apache.
export TICKETSYSTEM_STORAGE_DIR="$BASE/storage"

fail() { echo "ERROR: $*" >&2; exit 1; }

# Требуется та же минорная версия Python, с которой собран mod_wsgi.
PYTHON_VERSION="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
[[ "$PYTHON_VERSION" == "3.10" ]] || fail "Expected Python 3.10, got $PYTHON_VERSION"
[[ -d "$PUBLIC" ]] || fail "Directory not found: $PUBLIC"
[[ -f "$BASE/.env" ]] || fail "Missing: $BASE/.env"
[[ -f "$BASE/virtualenv.pyz" ]] || fail "Missing: $BASE/virtualenv.pyz"

cd -- "$BASE"
LOCK="$BASE/.deploy-lock"
if ! mkdir -- "$LOCK" 2>/dev/null; then
    fail "Another deployment is running (or stale lock: $LOCK)"
fi

TMP=""
RELEASE=""
RELEASE_CREATED=0
ACTIVATED=0
NEXT_WRITTEN=0
cleanup() {
    local status=$?
    trap - EXIT
    if [[ "$NEXT_WRITTEN" == 1 ]]; then
        rm -f -- "$PUBLIC/index.wsgi.next" || true
    fi
    [[ -z "$TMP" ]] || rm -rf -- "$TMP" || true
    # После переключения релиз сохраняем: старые процессы могут его использовать.
    if [[ "$RELEASE_CREATED" == 1 && "$ACTIVATED" == 0 ]]; then
        rm -rf -- "$RELEASE" || true
    fi
    rmdir -- "$LOCK" || true
    exit "$status"
}
trap cleanup EXIT

SHA="$(git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH" | cut -f1)"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Cannot resolve commit for $REPO/$BRANCH"

VERSION="$(date +%Y%m%d_%H%M%S)_${SHA:0:8}"
RELEASE="$BASE/releases/$VERSION"
mkdir -p -- "$BASE/releases"
TMP="$(mktemp -d "$BASE/.deploy.XXXXXXXX")"

echo "Downloading $SHA"
curl -fLsS --retry 3 \
    "https://github.com/$REPO/archive/$SHA.tar.gz" \
    -o "$TMP/source.tar.gz"
mkdir -- "$TMP/source"
tar -xzf "$TMP/source.tar.gz" -C "$TMP/source" --strip-components=1

[[ -f "$TMP/source/main.py" ]] || fail "Missing main.py"
[[ -f "$TMP/source/requirements.txt" ]] || fail "Missing requirements.txt"

mkdir -- "$RELEASE"
RELEASE_CREATED=1
cp -a -- "$TMP/source/." "$RELEASE/"
cp -- "$BASE/.env" "$RELEASE/.env"
chmod 600 -- "$RELEASE/.env"

# Отдельное окружение для каждого релиза.
echo "Installing dependencies into $RELEASE/venv"
"$PYTHON_BIN" "$BASE/virtualenv.pyz" "$RELEASE/venv"
"$RELEASE/venv/bin/python" -m pip install \
    --no-cache-dir --disable-pip-version-check \
    -r "$RELEASE/requirements.txt"
"$RELEASE/venv/bin/python" -m pip check
"$RELEASE/venv/bin/python" -m compileall -q -x '/venv/' "$RELEASE"

ACTIVATE="$RELEASE/venv/bin/activate_this.py"
[[ -f "$ACTIVATE" ]] || fail "Missing virtualenv activation script: $ACTIVATE"

# ВАЖНО: именно здесь явно выполняются Alembic (если use_alembic=True) и
# init_database() внутри bafser. Production runtime использует AUTO_SETUP=False.
# main.py НЕ запускает Flask-сервер, так как импортируется как модуль.
echo "Preflight: initializing database and importing application"
(
    cd -- "$RELEASE"
    "$RELEASE/venv/bin/python" - <<'PY'
import os
import sys

sys.argv.append("--setup")
import main
import bafser_config

expected = os.path.realpath(os.path.join(os.getcwd(), "main.py"))
actual = os.path.realpath(main.__file__)
if actual != expected:
    raise RuntimeError(f"Unexpected main module: {actual}")
if not callable(main.app):
    raise RuntimeError("main.app is not a WSGI callable")
if main.app.extensions["bafser_config"].AUTO_SETUP is not False:
    raise RuntimeError("Production runtime must use AUTO_SETUP=False")
if os.path.realpath(bafser_config.storage_path) != os.path.realpath(os.environ["TICKETSYSTEM_STORAGE_DIR"]):
    raise RuntimeError("Setup imported an unexpected persistent storage configuration")
print("Database initialization and application import OK")
PY
)

# Вставляем абсолютный путь как безопасный Python-литерал.
RELEASE_REPR="$("$PYTHON_BIN" -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$RELEASE")"
STORAGE_REPR="$("$PYTHON_BIN" -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$TICKETSYSTEM_STORAGE_DIR")"

# Проверка GET /?__deploy_check=<SHA> отвечает SHA только когда main.py
# действительно загружен из нужного каталога; Flask менять не требуется.
cat > "$TMP/index.wsgi" <<EOF
import os
import sys
from urllib.parse import parse_qs

BASE_DIR = $RELEASE_REPR
STORAGE_DIR = $STORAGE_REPR
DEPLOY_SHA = "$SHA"
VENV_DIR = os.path.join(BASE_DIR, "venv")

if sys.version_info[:2] != (3, 10):
    raise RuntimeError(
        f"TicketSystem requires Python 3.10, got {sys.version.split()[0]}"
    )

activate_this = os.path.join(VENV_DIR, "bin", "activate_this.py")
if not os.path.isfile(activate_this):
    raise RuntimeError(f"virtualenv activation file not found: {activate_this}")

with open(activate_this, "rb") as activation_file:
    exec(
        compile(activation_file.read(), activate_this, "exec"),
        {"__file__": activate_this},
    )

sys.path[:] = [BASE_DIR] + [p for p in sys.path if p != BASE_DIR]
os.chdir(BASE_DIR)
os.environ["TICKETSYSTEM_STORAGE_DIR"] = STORAGE_DIR

import main
_flask_app = main.app
if _flask_app.extensions["bafser_config"].AUTO_SETUP is not False:
    raise RuntimeError("Production runtime must use AUTO_SETUP=False")


def application(environ, start_response):
    params = parse_qs(environ.get("QUERY_STRING", ""))
    if params.get("__deploy_check") == [DEPLOY_SHA]:
        expected = os.path.realpath(os.path.join(BASE_DIR, "main.py"))
        loaded = os.path.realpath(getattr(main, "__file__", ""))
        healthy = loaded == expected
        body = (DEPLOY_SHA if healthy else "stale-python-modules").encode("ascii")
        start_response(
            "200 OK" if healthy else "503 Service Unavailable",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Cache-Control", "no-store"),
                ("Content-Length", str(len(body))),
            ],
        )
        return [body]
    return _flask_app(environ, start_response)
EOF

"$PYTHON_BIN" -m py_compile "$TMP/index.wsgi"

# Проверяем сам сгенерированный entrypoint, включая virtualenv и probe.
# Production import выполняется без --setup и не запускает миграции/seed.
echo "Preflight: checking generated WSGI entrypoint"
(
    cd -- "$RELEASE"
    WSGI_FILE="$TMP/index.wsgi" EXPECTED_SHA="$SHA" "$PYTHON_BIN" - <<'PY'
import os
import runpy

entry = runpy.run_path(os.environ["WSGI_FILE"])
response = {}

def start_response(status, headers, exc_info=None):
    response["status"] = status

body = b"".join(entry["application"](
    {"QUERY_STRING": "__deploy_check=" + os.environ["EXPECTED_SHA"]},
    start_response,
))
if response.get("status") != "200 OK" or body.decode("ascii") != os.environ["EXPECTED_SHA"]:
    raise RuntimeError(f"WSGI preflight failed: {response}, {body!r}")
print("WSGI preflight OK")
PY
)

# Копия активного WSGI для ручного отката.
if [[ -f "$PUBLIC/index.wsgi" ]]; then
    cp -p -- "$PUBLIC/index.wsgi" "$BASE/index.wsgi.previous"
fi

cp -- "$TMP/index.wsgi" "$PUBLIC/index.wsgi.next"
NEXT_WRITTEN=1
chmod 755 -- "$PUBLIC/index.wsgi.next"

echo "Activating $VERSION"
# При аварии между mv и установкой флага нельзя удалять уже активный релиз.
ACTIVATED=1
mv -f -- "$PUBLIC/index.wsgi.next" "$PUBLIC/index.wsgi"
NEXT_WRITTEN=0

echo "WSGI updated: $VERSION"
echo "Commit: $SHA"

if [[ -n "$DEPLOY_HEALTH_URL" ]]; then
    SEP='?'
    [[ "$DEPLOY_HEALTH_URL" == *'?'* ]] && SEP='&'
    PROBE_URL="${DEPLOY_HEALTH_URL}${SEP}__deploy_check=${SHA}"

    echo "Checking HTTP delivery of commit $SHA"
    consecutive=0
    for attempt in {1..12}; do
        response=""
        if response="$(curl -fsS --connect-timeout 5 --max-time 12 \
            -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' \
            "${PROBE_URL}&_probe=${attempt}")" && [[ "$response" == "$SHA" ]]; then
            consecutive=$((consecutive + 1))
            echo "HTTP check $attempt: matching commit ($consecutive consecutive)"
            if [[ "$consecutive" -ge 3 ]]; then
                echo "Deployment verified: $VERSION"
                exit 0
            fi
        else
            consecutive=0
            echo "HTTP check $attempt: new commit not confirmed" >&2
        fi
        sleep 2
    done

    echo "ERROR: new release was NOT verified over HTTP." >&2
    echo "WSGI was already switched to $RELEASE; no automatic rollback was made." >&2
    echo "Check mod_wsgi reload mode, Apache logs, and the HTTP URL." >&2
    exit 1
else
    echo "WARNING: DEPLOY_HEALTH_URL is not configured; HTTP release verification skipped." >&2
    echo "Configure it in $BASE/.deploy.conf to check the active commit." >&2
fi

echo "Deployed: $VERSION"
