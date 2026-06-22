@echo off
REM ============================================================
REM  UC GAA Maya 2026 - Fall Semester Lab Installer
REM  Run as daapo with admin elevation
REM ============================================================

echo.
echo ============================================================
echo  UC GAA Maya 2026 Lab Setup
echo ============================================================
echo.

REM ── 1. Create local folder structure ─────────────────────────
echo [1/8] Creating local folder structure...
mkdir "C:\Cincy\MayaApp\2026\prefs" 2>nul
mkdir "C:\Cincy\MayaApp\2026\scripts" 2>nul
mkdir "C:\Cincy\MayaApp\2026\plug-ins" 2>nul
mkdir "C:\Cincy\Shelves" 2>nul
mkdir "C:\Cincy\scripts" 2>nul
mkdir "C:\Cincy\plug-ins" 2>nul
mkdir "C:\Cincy\Autosave" 2>nul
mkdir "%USERPROFILE%\Documents\maya\2026\prefs" 2>nul
mkdir "%USERPROFILE%\Documents\maya\2026\scripts" 2>nul

REM ── 2. Deploy Maya.env to Documents ──────────────────────────
echo [2/8] Deploying Maya.env...
copy /Y "R:\UC_GAA\deploy\maya\2026\Maya.env" "%USERPROFILE%\Documents\maya\2026\Maya.env"

REM ── 3. Deploy userSetup.mel ───────────────────────────────────
echo [3/8] Deploying userSetup.mel...
copy /Y "R:\UC_GAA\deploy\maya\2026\scripts\userSetup.mel" "%USERPROFILE%\Documents\maya\2026\scripts\userSetup.mel"
copy /Y "R:\UC_GAA\deploy\maya\2026\scripts\userSetup.mel" "C:\Cincy\MayaApp\2026\scripts\userSetup.mel"

REM ── 4. Deploy userPrefs.mel ───────────────────────────────────
echo [4/8] Deploying userPrefs.mel...
copy /Y "R:\UC_GAA\deploy\maya\2026\prefs\userPrefs.mel" "%USERPROFILE%\Documents\maya\2026\prefs\userPrefs.mel"
copy /Y "R:\UC_GAA\deploy\maya\2026\prefs\userPrefs.mel" "C:\Cincy\MayaApp\2026\prefs\userPrefs.mel"

REM ── 5. Deploy pluginPrefs.mel (delete dirty, copy clean, lock) 
echo [5/8] Deploying pluginPrefs.mel...
attrib -R "%USERPROFILE%\Documents\maya\2026\prefs\pluginPrefs.mel" 2>nul
del /F /Q "%USERPROFILE%\Documents\maya\2026\prefs\pluginPrefs.mel" 2>nul
copy /Y "R:\UC_GAA\deploy\maya\2026\prefs\pluginPrefs.mel" "%USERPROFILE%\Documents\maya\2026\prefs\pluginPrefs.mel"
attrib +R "%USERPROFILE%\Documents\maya\2026\prefs\pluginPrefs.mel"
robocopy "R:\UC_GAA\deploy\maya\2026\prefs" "C:\Cincy\MayaApp\2026\prefs" pluginPrefs.mel /IS

REM ── 6. Deploy CODE.mod ───────────────────────────────────────
echo [6/8] Deploying CODE.mod...
copy /Y "\\artscifs1.ad.uc.edu\Departments\GAA\modules\CODE.mod" "C:\Cincy\CODE.mod"

REM ── 7. Deploy launcher.py ────────────────────────────────────
echo [7/8] Deploying launcher.py...
copy /Y "R:\UC_GAA\deploy\launcher.py" "C:\Cincy\scripts\launcher.py"

REM ── 8. Add shottracker:// URI scheme to registry ─────────────
echo [8/8] Registering shottracker:// URI scheme...
reg add "HKLM\SOFTWARE\Classes\shottracker" /ve /d "URL:Shot Tracker Protocol" /f
reg add "HKLM\SOFTWARE\Classes\shottracker" /v "URL Protocol" /d "" /f
reg add "HKLM\SOFTWARE\Classes\shottracker\shell\open\command" /ve /d "\"C:\Program Files\Autodesk\Maya2026\bin\mayapy.exe\" \"C:\Cincy\scripts\launcher.py\" \"%%1\"" /f

echo.
echo ============================================================
echo  Done! Maya 2026 environment configured.
echo ============================================================
echo.
pause