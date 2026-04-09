@echo off
cd /d C:\myapp\shot-tracking-dev

:: Activate venv
call venv\Scripts\activate

:: Set env variables
set FLASK_APP=src.app
set PYTHONPATH=%CD%\src
set FLASK_ENV=development

:: Run Flask
python -m flask run --host=0.0.0.0 --port=5000

pause
