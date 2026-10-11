@echo off
title GRT Student App
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist "node_modules\express\package.json" goto install
if not exist "node_modules\vite\package.json" goto install
goto build

:install
echo.
echo [1/3] Installing packages - please wait, needs internet...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed

:build
if not exist ".env" copy ".env.example" ".env" >nul
echo.
echo [2/3] Building the website with the latest files...
call npm run build
if errorlevel 1 goto failed

echo.
echo [3/3] Starting... your browser opens by itself. Tap the intro once to start it. Keep this window open.
set OPEN_BROWSER=1
call node backend\server.js
echo.
echo The server stopped. Read the message above.
pause
exit /b 0

:nonode
echo Node.js is not installed. Download the LTS version from https://nodejs.org , install it, then run RUN.bat again.
pause
exit /b 1

:failed
echo.
echo Something failed. Copy the text above and send it for help.
pause
exit /b 1
