@echo off
cd /d "%~dp0"
if not exist "tools\serve.py" (
  echo This launcher needs the complete extracted Atlas folder.
  echo In the ZIP window, choose Extract All, then run Start_Atlas.cmd from the extracted folder.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 tools\serve.py
) else (
  python tools\serve.py
)
if errorlevel 1 (
  echo.
  echo Atlas could not start. Read the error above for the cause.
  pause
)
