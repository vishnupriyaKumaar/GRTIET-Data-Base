@echo off
REM ONE-TIME DEPLOY (Windows): frontend + backend go to Vercel as ONE project.
REM Double-click this file. The first time it asks you to log in to Vercel.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)
echo.
echo [1/3] Installing packages...
call npm install || (echo npm install failed & pause & exit /b 1)
echo.
echo [2/3] Checking the build works...
call npm run build || (echo Build failed & pause & exit /b 1)
echo.
echo [3/3] Deploying to Vercel (log in when asked, answer the questions with Enter)...
call npx vercel@latest --prod
echo.
echo Done. If this is your first deploy, add the environment variables in
echo Vercel - Project - Settings - Environment Variables (see DEPLOY-ONE-TIME.md), then run this file again.
pause
