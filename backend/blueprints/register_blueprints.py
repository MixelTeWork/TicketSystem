import importlib
import os


def register_blueprints(app):
    for file in os.listdir("blueprints"):
        if not file.endswith(".py") or file == "register_blueprints.py":
            continue
        module = "blueprints." + file[:-3]
        blueprint = importlib.import_module(module).blueprint
        app.register_blueprint(blueprint)
