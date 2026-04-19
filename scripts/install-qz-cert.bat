@echo off
:: QZ Tray Certificate Installer for Bettencourt POS
:: Run as Administrator. Downloads the signing cert from the POS server
:: and installs it as override.crt so QZ Tray trusts it silently.

set POS_URL=https://pos.bettencourtgy.com/api/qz/override.crt
set QZ_DIR=C:\Program Files\QZ Tray
set CERT_PATH=%QZ_DIR%\override.crt

echo Bettencourt POS - QZ Tray Certificate Installer
echo ================================================

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please right-click this file and choose "Run as Administrator"
    pause
    exit /b 1
)

:: Check QZ Tray is installed
if not exist "%QZ_DIR%" (
    echo ERROR: QZ Tray not found at "%QZ_DIR%"
    echo Please install QZ Tray first from https://qz.io/download
    pause
    exit /b 1
)

:: Download cert
echo Downloading certificate from %POS_URL% ...
powershell -Command "Invoke-WebRequest -Uri '%POS_URL%' -OutFile '%CERT_PATH%' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo ERROR: Failed to download certificate. Check network connection.
    pause
    exit /b 1
)

echo Certificate installed to: %CERT_PATH%

:: Restart QZ Tray if running
tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if %errorlevel% equ 0 (
    echo Restarting QZ Tray...
    taskkill /f /im qz-tray.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "" "%QZ_DIR%\qz-tray.exe"
    echo QZ Tray restarted.
) else (
    echo QZ Tray is not running. Please start it manually.
)

echo.
echo Done! Next time you print, QZ Tray will show "Valid Certificate"
echo and you can click "Always Allow" to never see the dialog again.
echo.
pause
