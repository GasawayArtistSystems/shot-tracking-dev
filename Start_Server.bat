@echo off
setlocal

REM Use current folder (portable)
cd /d %~dp0

REM Set environment
set PYTHONPATH=%cd%\src
set FLASK_APP=src.app
set FLASK_ENV=production
set PYTHONUTF8=1

REM Run server
venv\Scripts\python.exe -m waitress --host=0.0.0.0 --port=8000 src.app:app

pause