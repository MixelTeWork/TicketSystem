from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import sys

import pytest


@pytest.mark.skipif(sys.version_info[:2] != (3, 10), reason="The deployment targets a Python 3.10 mod_wsgi runtime")
@pytest.mark.parametrize("auto_setup", [False, True])
def test_generated_wsgi_uses_persistent_storage_and_requires_explicit_setup(tmp_path: Path, auto_setup: bool):
    # Render only the Python heredoc. Never execute the deployment shell script.
    deploy = (Path(__file__).resolve().parents[3] / "deploy.sh").read_text(encoding="utf-8")
    template = deploy.split('cat > "$TMP/index.wsgi" <<EOF\n', 1)[1].split("\nEOF\n", 1)[0]
    release = tmp_path / "release 'quoted' $SHA `literal`"
    activation = release / "venv" / "bin" / "activate_this.py"
    activation.parent.mkdir(parents=True)
    activation.write_text("import os\nos.environ['TEST_ACTIVATION'] = 'ready'\n", encoding="utf-8")
    # No directory with this name is needed: the fake app only observes the value.
    storage = str(tmp_path / 'storage "quoted" $SHA `literal` Фестиваль')
    sha = "a" * 40
    replacements = {"RELEASE_REPR": json.dumps(str(release)), "STORAGE_REPR": json.dumps(storage), "SHA": sha}
    # One pass preserves dollar signs inside an inserted literal, as the shell does.
    rendered = re.sub(r"\$(RELEASE_REPR|STORAGE_REPR|SHA)\b", lambda match: replacements[match.group(1)], template)
    entrypoint = tmp_path / "index.wsgi"
    entrypoint.write_text(rendered, encoding="utf-8")

    script = """
import os
from pathlib import Path
import runpy
import sys
import types

entrypoint, release, storage, sha, auto_setup = sys.argv[1:]
auto_setup = auto_setup == "True"
os.environ["TICKETSYSTEM_STORAGE_DIR"] = "inherited-wrong-storage"

class Application:
    config = {}
    extensions = {"bafser_config": types.SimpleNamespace(AUTO_SETUP=auto_setup)}

    def __call__(self, environ, start_response):
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"application"]

main = types.ModuleType("main")
main.__file__ = str(Path(release) / "main.py")
main.app = Application()
assert "AUTO_SETUP" not in main.app.config
assert main.app.extensions["bafser_config"].AUTO_SETUP is auto_setup
sys.modules["main"] = main

try:
    entry = runpy.run_path(entrypoint)
except RuntimeError as error:
    assert auto_setup and str(error) == "Production runtime must use AUTO_SETUP=False"
else:
    assert not auto_setup
    assert os.environ["TICKETSYSTEM_STORAGE_DIR"] == storage
    assert os.environ["TEST_ACTIVATION"] == "ready"
    assert Path.cwd() == Path(release)
    assert sys.path[0] == release
    response = {}

    def start_response(status, headers, exc_info=None):
        response["status"] = status

    body = b"".join(entry["application"]({"QUERY_STRING": "__deploy_check=" + sha}, start_response))
    assert response["status"] == "200 OK" and body == sha.encode("ascii")
    assert b"".join(entry["application"]({"QUERY_STRING": ""}, start_response)) == b"application"
"""
    result = subprocess.run(
        [sys.executable, "-c", script, str(entrypoint), str(release), storage, sha, str(auto_setup)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stdout + result.stderr
