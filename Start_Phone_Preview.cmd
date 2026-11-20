@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python tools\serve.py --phone %*
) else (
  py -3 tools\serve.py --phone %*
)
if errorlevel 1 pause
