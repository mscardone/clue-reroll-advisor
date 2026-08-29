@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  echo Starting the Clue Re-roll Advisor server on http://localhost:8231/ ...
  node tools\serve.js %1
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    echo Node not found - falling back to Python.
    echo Add to Alt1:  alt1://addapp/http://localhost:8231/appconfig.json
    py -m http.server 8231
  ) else (
    echo Neither Node nor Python was found on this PC.
    echo Install Node ^(nodejs.org^) or Python, or host the folder any other way.
  )
)
pause
