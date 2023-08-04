from flask import Flask, abort, jsonify, make_response, redirect, request, send_from_directory
from flask_jwt_extended import JWTManager
from data import db_session
from blueprints.api import blueprint as blueprint_api
from blueprints.authentication import blueprint as blueprint_authentication
from utils import get_jwt_secret_key
from logger import setLogging
import logging
import traceback
import os

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
    db_session.global_init("db/TicketSystem.db")
    app.register_blueprint(blueprint_api)
    app.register_blueprint(blueprint_authentication)
    if __name__ == "__main__":
        app.run(debug=True)


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
        return make_response(jsonify({"error": "Not found"}), 404)
    return make_response("Страница не найдена", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    return make_response(jsonify({"error": "Method Not Allowed"}), 405)


@app.errorhandler(415)
def unsupported_media_type(error):
    return make_response(jsonify({"error": "Unsupported Media Type"}), 415)


@app.errorhandler(500)
@app.errorhandler(Exception)
def internal_server_error(error):
    print(error)
    logging.error(f"{error}\n{traceback.format_exc()}")
    if request.path.startswith("/api/"):
        return make_response(jsonify({"error": "Internal Server Error"}), 500)
    else:
        return make_response("Произошла ошибка", 500)


@app.errorhandler(401)
def unauthorized(error):
    if request.path.startswith("/api/"):
        return make_response(jsonify({"error": "Unauthorized"}), 401)
    else:
        return redirect("/login")


@jwt_manager.expired_token_loader
def expired_token_loader():
    return jsonify({"error": "The JWT has expired"}), 401


@jwt_manager.invalid_token_loader
def invalid_token_loader(error):
    return jsonify({"error": "Invalid JWT"}), 401


@jwt_manager.unauthorized_loader
def unauthorized_loader(error):
    return jsonify({"error": "Unauthorized"}), 401


main()
