import os

APP_NAME = "Film and Shot Tracker"
APP_VERSION = "1.21"
APP_COPYRIGHT = "© Gasman Group, LLC"
APP_YEAR = "2025-6"


# Base directory of the project
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'database', 'app.db')




class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key")
    DEBUG = False
    DATABASE = DATABASE
    ENV = "base"
    # Moved upload config here:
    UPLOAD_FOLDER = os.path.join(BASE_DIR, '../uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max
    ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'wmv', 'png'}

    APP_NAME = APP_NAME
    APP_VERSION = APP_VERSION
    APP_COPYRIGHT = APP_COPYRIGHT


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    ENV = "development"


class TestingConfig(BaseConfig):
    TESTING = True
    ENV = "testing"
    DATABASE = os.getenv("DATABASE", os.path.join(BASE_DIR, "database", "test_app.db"))


class ProductionConfig(BaseConfig):
    DEBUG = False
    ENV = "production"


UPLOAD_FOLDER = BaseConfig.UPLOAD_FOLDER
MAX_CONTENT_LENGTH = BaseConfig.MAX_CONTENT_LENGTH



