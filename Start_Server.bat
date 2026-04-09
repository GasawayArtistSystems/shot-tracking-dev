@echo off
setlocal

REM Force working directory
cd /d C:\myapp\shot-tracking-dev

REM Minimal env with absolute paths
set PYTHONPATH=C:\myapp\shot-tracking-dev\src
set FLASK_APP=src.app
set FLASK_ENV=production
set PYTHONUTF8=1

REM Launch waitress directly with absolute python path
C:\myapp\shot-tracking-dev\venv\Scripts\python.exe -m waitress --host=0.0.0.0 --port=8000 src.app:app
