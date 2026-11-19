@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 tools\serve.py
) else (
  python tools\serve.py
)
if errorlevel 1 (
  echo.
  echo Atlas could not start. Check that Python 3 is installed and port 8001 is free.
  pause
)
