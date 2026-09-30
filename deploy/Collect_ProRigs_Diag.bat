@echo off
setlocal EnableDelayedExpansion

rem ============================================================================
rem  Collect_ProRigs_Diag.bat
rem
rem  Gathers everything needed to work out why ProRigs is not loading for a
rem  student. Reads only - changes nothing.
rem
rem  RUN IT AS THE STUDENT WHO HAS THE PROBLEM (a normal double-click, NOT
rem  "Run as administrator") - we need that account's real environment, not
rem  an admin's.
rem
rem  Writes a report to the Desktop:  ProRigs_Diag_<user>_<date>.txt
rem  Send that file back.
rem ============================================================================

set "OUT=%USERPROFILE%\Desktop\ProRigs_Diag_%USERNAME%_%DATE:/=-%.txt"
set "OUT=%OUT: =_%"

call :main > "%OUT%" 2>&1

echo.
echo  Report written to:
echo    %OUT%
echo.
echo  Please send that file back.
echo.
echo  Press any key to close . . .
pause >nul
endlocal
exit /b 0

:main
echo ==========================================================================
echo  ProRigs diagnostic report
echo  Generated: %DATE% %TIME%
echo ==========================================================================
echo.
echo --- Who is running this -------------------------------------------------
whoami
echo.
echo --- MAYA_APP_DIR (this determines where Maya reads prefs/env) ----------
echo   In THIS session:            [%MAYA_APP_DIR%]
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v MAYA_APP_DIR 2^>nul ^| find "MAYA_APP_DIR"') do echo   Machine environment var:    [%%B]
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v MAYA_APP_DIR 2^>nul ^| find "MAYA_APP_DIR"') do echo   User environment var:       [%%B]
echo.
echo --- Other Maya vars in this session -----------------------------------
set MAYA_
echo.
echo --- Maya installs on this machine ------------------------------------
for %%Y in (2024 2025 2026 2027) do (
    for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Autodesk\Maya\%%Y\Setup\InstallPath" /v MAYA_INSTALL_LOCATION /reg:64 2^>nul ^| find "MAYA_INSTALL_LOCATION"') do echo   Maya %%Y: %%B
)
echo.
echo ==========================================================================
echo  ProRigs machine-wide install
echo ==========================================================================
echo.
echo --- C:\ProgramData\ProRigs (full tree) --------------------------------
if exist "C:\ProgramData\ProRigs\" (
    dir /s /b "C:\ProgramData\ProRigs"
) else (
    echo   *** C:\ProgramData\ProRigs DOES NOT EXIST ***
)
echo.
echo --- ProRigsConfig.ini (key line masked) -------------------------------
if exist "C:\ProgramData\ProRigs\ProRigsConfig.ini" (
    for /f "usebackq delims=" %%L in ("C:\ProgramData\ProRigs\ProRigsConfig.ini") do (
        set "LINE=%%L"
        set "LC=!LINE:key=!"
        if not "!LC!"=="!LINE!" (echo   [key line present, value hidden]) else (echo   !LINE!)
    )
) else (
    echo   not found
)
echo.
echo --- Autodesk Shared Modules: ProRigs.mod files ------------------------
for %%Y in (2024 2025 2026 2027) do (
    if exist "C:\Program Files\Common Files\Autodesk Shared\Modules\maya\%%Y\ProRigs.mod" (
        echo   [%%Y] ProRigs.mod:
        for /f "usebackq delims=" %%L in ("C:\Program Files\Common Files\Autodesk Shared\Modules\maya\%%Y\ProRigs.mod") do echo         %%L
    )
)
echo.
echo --- PRLicensePlugin.mll copies found --------------------------------
for %%Y in (2024 2025 2026 2027) do (
    if exist "C:\ProgramData\ProRigs\maya\%%Y\plug-ins\PRLicensePlugin.mll" echo   [%%Y] ProgramData:  present
    for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Autodesk\Maya\%%Y\Setup\InstallPath" /v MAYA_INSTALL_LOCATION /reg:64 2^>nul ^| find "MAYA_INSTALL_LOCATION"') do (
        if exist "%%B\bin\plug-ins\PRLicensePlugin.mll" (echo   [%%Y] Maya bin:     present ^(trust fix applied^)) else (echo   [%%Y] Maya bin:     not present)
    )
)
echo.
echo ==========================================================================
echo  Maya prefs actually in use  (C:\Cincy\MayaApp)
echo ==========================================================================
for %%Y in (2024 2025 2026 2027) do (
    if exist "C:\Cincy\MayaApp\%%Y\prefs\" (
        echo.
        echo --- C:\Cincy\MayaApp\%%Y\prefs ---
        dir "C:\Cincy\MayaApp\%%Y\prefs"
        echo.
        echo --- pluginPrefs.mel ---
        if exist "C:\Cincy\MayaApp\%%Y\prefs\pluginPrefs.mel" (
            attrib "C:\Cincy\MayaApp\%%Y\prefs\pluginPrefs.mel"
            type "C:\Cincy\MayaApp\%%Y\prefs\pluginPrefs.mel"
        )
        echo.
        echo --- security / trusted-plugin lines in userPrefs.mel ---
        if exist "C:\Cincy\MayaApp\%%Y\prefs\userPrefs.mel" (
            findstr /i "trust secure plugin nonTrusted SafeMode" "C:\Cincy\MayaApp\%%Y\prefs\userPrefs.mel"
        ) else (
            echo   userPrefs.mel not found here
        )
    )
)
echo.
echo --- Same, under this user's Documents (in case MAYA_APP_DIR isn't set) --
for %%Y in (2024 2025 2026 2027) do (
    if exist "%USERPROFILE%\Documents\maya\%%Y\prefs\pluginPrefs.mel" (
        echo.
        echo --- %USERPROFILE%\Documents\maya\%%Y\prefs\pluginPrefs.mel ---
        type "%USERPROFILE%\Documents\maya\%%Y\prefs\pluginPrefs.mel"
    )
)
echo.
echo ==========================================================================
echo  ProRigs install logs
echo ==========================================================================
for /f "delims=" %%D in ('dir /b /s /a-d "%USERPROFILE%\Documents\maya\ProRigs\Logs\*.log" "C:\Cincy\MayaApp\ProRigs\Logs\*.log" 2^>nul') do echo   found: %%D
echo.
echo   (send the most recent one alongside this report)
echo.
echo ==========================================================================
echo  Maya.env in effect
echo ==========================================================================
for %%P in ("C:\Cincy\MayaApp\2026\Maya.env" "%USERPROFILE%\Documents\maya\2026\Maya.env") do (
    if exist %%P (
        echo --- %%P ---
        type %%P
        echo.
    )
)
echo.
echo ==========================================================================
echo  End of report
echo ==========================================================================
goto :eof
