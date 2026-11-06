@echo off
rem Starts PerkTonic locally: Docker Desktop -> local database -> dev server -> browser.
rem Double-click it. Close this window (or press Ctrl+C) to stop the dev server.
setlocal enabledelayedexpansion
cd /d "%~dp0"
title PerkTonic - local dev (http://localhost:3000)

echo [1/4] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo       Docker is not running - starting Docker Desktop, please wait...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  for /l %%i in (1,1,60) do (
    docker info >nul 2>&1
    if not errorlevel 1 goto docker_ready
    timeout /t 3 /nobreak >nul
  )
  echo       Docker did not start in time. Open Docker Desktop by hand, then run this file again.
  pause
  exit /b 1
)
:docker_ready

echo [2/4] Starting the local database (viraltrendly-db)...
docker start viraltrendly-db >nul 2>&1
for /l %%i in (1,1,30) do (
  docker exec viraltrendly-db pg_isready -U postgres >nul 2>&1
  if not errorlevel 1 goto db_ready
  timeout /t 2 /nobreak >nul
)
echo       The database container did not become ready. Check it in Docker Desktop.
pause
exit /b 1
:db_ready

rem Already running (e.g. started earlier)? Just open it instead of failing with "Another next dev server is already running".
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo       The dev server is already running on port 3000 - opening the browser.
  start "" http://localhost:3000
  timeout /t 3 /nobreak >nul
  exit /b 0
)

echo [3/4] Opening the browser in a few seconds...
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:3000"

echo [4/4] Starting the dev server (first load of each page can take a few seconds)...
call npm run dev -- -p 3000
pause
