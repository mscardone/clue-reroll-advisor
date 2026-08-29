@echo off
cd /d "%~dp0"
echo Starting the Clue Re-roll Advisor server...
node tools\serve.js %1
pause
