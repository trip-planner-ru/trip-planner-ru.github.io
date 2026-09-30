@echo off
title Trip Planner - do not close this window
cd /d "%~dp0"
if not exist node_modules call npm install
echo Starting Trip Planner... the browser will open automatically.
call npm run dev -- --open
pause
