@echo off
setlocal

REM === EDIT THESE THREE PATHS ===
set "SQLITE_EXE=C:\Tools\sqlite\sqlite3.exe"
set "DB_FILE=C:\myapp\shot-tracking-dev\src\app\database\app.db"
set "BACKUP_DIR=C:\myapp\backups\db"

REM === Make sure backup folder exists ===
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM === Make a clean timestamp like 2025-09-08_23-59-00 ===
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyy-MM-dd_HH-mm-ss\")"') do set "STAMP=%%i"

echo ==========================================
echo Starting SQLite backup
echo ==========================================
echo Using SQLite EXE : %SQLITE_EXE%
echo Database file    : %DB_FILE%
echo Backup folder    : %BACKUP_DIR%
echo Timestamp        : %STAMP%
echo ------------------------------------------

REM === Verify sqlite3.exe exists ===
if not exist "%SQLITE_EXE%" (
    echo ❌ ERROR: sqlite3.exe not found at %SQLITE_EXE%
    pause
    exit /b 1
)

REM === Show SQLite version (for sanity check) ===
"%SQLITE_EXE%" -version

REM === Safe SQLite backup ===
"%SQLITE_EXE%" "%DB_FILE%" ".backup '%BACKUP_DIR%\app_%STAMP%.db'"

if errorlevel 1 (
    echo ❌ SQLite backup failed!
    pause
    exit /b 1
)

REM === Compare file sizes ===
for %%F in ("%DB_FILE%") do set "ORIG_SIZE=%%~zF"
for %%F in ("%BACKUP_DIR%\app_%STAMP%.db") do set "BACKUP_SIZE=%%~zF"

echo ------------------------------------------
echo Original size: %ORIG_SIZE% bytes
echo Backup size  : %BACKUP_SIZE% bytes
echo ------------------------------------------

if "%ORIG_SIZE%"=="" (
    echo ❌ Original DB not found or size check failed!
) else (
    if "%BACKUP_SIZE%"=="" (
        echo ❌ Backup failed — no output file created.
    ) else (
        echo ✅ Backup successful!
    )
)

pause
