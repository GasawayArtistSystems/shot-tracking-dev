# src/main.py

import os
import sys
import webbrowser
import threading

from app import create_app
from app.config import DevelopmentConfig, ProductionConfig

def open_browser():
    webbrowser.open("http://localhost:5000")

# Choose config class based on environment variable
env = os.environ.get("FLASK_ENV", "development").lower()
config_class = ProductionConfig if env == "production" else DevelopmentConfig

app = create_app(config_override=config_class)

if __name__ == "__main__":
    threading.Timer(1.5, open_browser).start()
    app.run(host="127.0.0.1", port=5000, debug=app.config["DEBUG"])




