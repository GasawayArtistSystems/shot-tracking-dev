@echo off
rem ============================================================================
rem  Fix_ProRigs_Trust.bat
rem
rem  Thin wrapper: checks for Administrator rights, then runs
rem  Fix_ProRigs_Trust.ps1 (which does the real work - see the header in that
rem  file). Keep the two files together.
rem
rem  USAGE: right-click this file -> Run as administrator
rem  (run the ProRigs lab installer on the machine first).
rem ============================================================================

fsutil dirty query %systemdrive% >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: not running as Administrator.
    echo  Right-click this file and choose "Run as administrator".
    echo.
    echo  Press any key to close . . .
    pause >nul
    exit /b 1
)

if not exist "%~dp0Fix_ProRigs_Trust.ps1" (
    echo.
    echo  ERROR: Fix_ProRigs_Trust.ps1 not found next to this file.
    echo  Keep the two files together.
    echo.
    echo  Press any key to close . . .
    pause >nul
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Fix_ProRigs_Trust.ps1"
exit /b %ERRORLEVEL%
