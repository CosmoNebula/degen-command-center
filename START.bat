@echo off
cd /d "%~dp0"
echo.
echo   ◈ DEGEN COMMAND CENTER ◈
echo   Starting up...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠ Node.js not found!
    echo   Download it from: https://nodejs.org
    echo   Get the LTS version, install, then double-click this again
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo   Installing dependencies (first time only)...
    call npm install
)

echo   🚀 Launching battlefield...
echo   Opening browser in 3 seconds...
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
call npm run dev
