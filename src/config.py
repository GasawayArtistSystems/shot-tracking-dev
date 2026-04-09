# src/config.py

import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'fallback-secret-key')
    STATIC_FOLDER = 'static'
    TEMPLATES_FOLDER = 'templates'

class DevelopmentConfig(Config):
    DEBUG = True
    ENV = 'development'

class ProductionConfig(Config):
    DEBUG = False
    ENV = 'production'




