@echo off
REM ==========================================
REM Start Flask app with waitress from shared drive
REM ==========================================

REM Move to project directory
cd /d Z:\

REM Path to virtual environment
set VENV_DIR=Z:\venv

REM Step 1: Check Python availability
where python >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in PATH.
    pause
    exit /b 1
)

REM Step 2: Create venv if missing
if not exist "%VENV_DIR%" (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

REM Step 3: Activate venv
call "%VENV_DIR%\Scripts\activate.bat"

REM Step 4: Install dependencies
if exist "requirements.txt" (
    echo Installing dependencies...
    pip install --upgrade pip
    pip install -r "requirements.txt"
) else (
    echo No requirements.txt found. Installing waitress only...
    pip install waitress
)

REM Step 5: Start Flask app
echo Starting Flask app with waitress...
python -m waitress --listen=*:5000 src.app:app

pause
