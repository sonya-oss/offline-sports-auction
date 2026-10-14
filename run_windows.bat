@echo off
cd /d "%~dp0"
py -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install Flask. Check that Python and pip are installed.
  pause
  exit /b 1
)
py server.py
pause
