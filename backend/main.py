from flask import Flask, jsonify, make_response, redirect, request, send_from_directory
from flask_jwt_extended import JWTManager
from data import db_session
from blueprints.api import blueprint as blueprint_api
from blueprints.authentication import blueprint as blueprint_authentication
from logger import setLogging
import logging
import traceback
import os

setLogging()
app = Flask(__name__, static_folder="build", static_url_path="/")
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_SECRET_KEY"] = "secret_key_for_ticket_system_project"
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


@app.route("/")
def index():
    return send_from_directory("build", "index.html")


@app.errorhandler(404)
def not_found(error):
    if (request.path.startswith("/api")):
        return make_response(jsonify({"error": "Not found"}), 404)
    return make_response("Страница не найдена", 404)


@app.errorhandler(405)
def not_found(error):
    if (request.path.startswith("/api")):
        return make_response(jsonify({"error": "Method Not Allowed"}), 405)
    return make_response("Method Not Allowed", 405)


@app.errorhandler(500)
@app.errorhandler(Exception)
def internal_server_error(error):
    print(error)
    logging.error(f"{error}\n{traceback.format_exc()}")
    if (request.path.startswith("/api/")):
        return make_response(jsonify({"error": "Internal Server Error"}), 500)
    else:
        return make_response("Произошла ошибка", 500)


@app.errorhandler(401)
def unauthorized(error):
    if (request.path.startswith("/api/")):
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
