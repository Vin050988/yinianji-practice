@echo off
chcp 936 >nul
cd /d "%~dp0"
title 一年级练习 - 本地服务器

echo ============================================
echo            一年级练习 - 本地启动
echo ============================================
echo.

set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined IP set "IP=%%a"
)
set "IP=%IP: =%"
if "%IP%"=="" set "IP=localhost"

echo   本机浏览: http://localhost:8090
echo   iPad 浏览: http://%IP%:8090
echo.
echo   iPad 请连同一个 WiFi，用 Safari 打开上面第二行地址，
echo   再点分享 - 添加到主屏幕。
echo   关闭本窗口 = 停止服务。
echo.

python --version >nul 2>nul
if %errorlevel%==0 (
    echo [OK] 正在用 Python 启动服务器...
    echo.
    python -m http.server 8090 --bind 0.0.0.0
    goto end
)

py -3 --version >nul 2>nul
if %errorlevel%==0 (
    echo [OK] 正在用 Python(py) 启动服务器...
    echo.
    py -3 -m http.server 8090 --bind 0.0.0.0
    goto end
)

echo [!] 没有找到 Python，改用 PowerShell 备用服务器...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
goto end

:end
echo.
echo 服务已停止。按任意键关闭窗口。
pause >nul
