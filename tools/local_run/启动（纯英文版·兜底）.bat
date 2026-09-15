@echo off
cd /d "%~dp0"
title Yinianji Practice - Local Server

set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined IP set "IP=%%a"
)
set "IP=%IP: =%"
if "%IP%"=="" set "IP=localhost"

echo ============================================
echo   Yinianji Practice - local server
echo ============================================
echo.
echo   Local : http://localhost:8090
echo   iPad  : http://%IP%:8090
echo.
echo   Open the iPad URL in Safari (same Wi-Fi),
echo   then Share - Add to Home Screen.
echo   Close this window to stop the server.
echo.

python --version >nul 2>nul
if %errorlevel%==0 (
    python -m http.server 8090 --bind 0.0.0.0
    goto end
)

py -3 --version >nul 2>nul
if %errorlevel%==0 (
    py -3 -m http.server 8090 --bind 0.0.0.0
    goto end
)

echo Python not found. Starting PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

:end
echo.
echo Server stopped. Press any key to close.
pause >nul
