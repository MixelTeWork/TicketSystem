from flask import Flask, abort, jsonify, make_response, redirect, request, send_from_directory
from flask_jwt_extended import JWTManager
from data import db_session
from blueprints.api import blueprint as blueprint_api
from blueprints.authentication import blueprint as blueprint_authentication
from data.init_values import init_values
from utils import get_jwt_secret_key
from logger import setLogging
import logging
import traceback
import os
import sys
import time

setLogging()
FRONTEND_FOLDER = "build"
app = Flask(__name__, static_folder=None)
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_SECRET_KEY"] = get_jwt_secret_key()
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
app.config["JWT_COOKIE_CSRF_PROTECT"] = False

jwt_manager = JWTManager(app)


def main():
    if not os.path.exists("db"):
        os.makedirs("db")
    db_path = "db/TicketSystem.db"
    db_new = not os.path.exists(db_path)
    db_session.global_init(db_path)
    if db_new:
        init_values()
    app.register_blueprint(blueprint_api)
    app.register_blueprint(blueprint_authentication)
    if __name__ == "__main__":
        print("Starting")
        app.run(debug=True)


@app.before_request
def before_request():
    if "delay" in sys.argv:
        time.sleep(0.5)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    if request.path.startswith("/api"):
        abort(404)
    if path != "" and os.path.exists(FRONTEND_FOLDER + "/" + path):
        return send_from_directory(FRONTEND_FOLDER, path)
    else:
        return send_from_directory(FRONTEND_FOLDER, "index.html")


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api"):
        return make_response(jsonify({"msg": "Not found"}), 404)
    return make_response("Страница не найдена", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    return make_response(jsonify({"msg": "Method Not Allowed"}), 405)


@app.errorhandler(415)
def unsupported_media_type(error):
    return make_response(jsonify({"msg": "Unsupported Media Type"}), 415)


@app.errorhandler(500)
@app.errorhandler(Exception)
def internal_server_error(error):
    print(error)
    logging.error(f"{error}\n{traceback.format_exc()}")
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Internal Server Error"}), 500)
    else:
        return make_response("Произошла ошибка", 500)


@app.errorhandler(401)
def unauthorized(error):
    if request.path.startswith("/api/"):
        return make_response(jsonify({"msg": "Unauthorized"}), 401)
    else:
        return redirect("/login")


@jwt_manager.expired_token_loader
def expired_token_loader():
    return jsonify({"msg": "The JWT has expired"}), 401


@jwt_manager.invalid_token_loader
def invalid_token_loader(error):
    return jsonify({"msg": "Invalid JWT"}), 401


@jwt_manager.unauthorized_loader
def unauthorized_loader(error):
    return jsonify({"msg": "Unauthorized"}), 401


main()
