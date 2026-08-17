@echo off
echo Starting Nursing Study Platform...
echo =================================
echo.
echo Starting local server...
echo The platform will open in your browser automatically
echo.
echo Server address: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

python -m http.server 3000 --bind 0.0.0.0

pause
