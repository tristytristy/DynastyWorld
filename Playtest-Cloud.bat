@echo off
REM ============================================================
REM  CLOUD playtest instance of CFB 27 Dynasty Hub.
REM
REM  Same app as Playtest-Isolated.bat, but the data folder lives
REM  inside a cloud-synced folder (OneDrive / Dropbox / Google
REM  Drive). Use this SAME launcher on every PC and the archive,
REM  DynastyTube descriptions, Net posts, settings - everything -
REM  follows you automatically. No more copying CFB-Playtest-Data
REM  by hand.
REM
REM  THE TWO RULES:
REM    1. Never run the app on two PCs at the same time.
REM    2. Before launching on the OTHER PC, wait until your cloud
REM       client shows the folder fully synced (green checkmarks).
REM
REM  Your GAME saves are never modified (the app only reads them).
REM ============================================================
setlocal

REM ---- Pick the cloud folder -------------------------------------
REM To force a specific location, put its full path on the next line
REM (remove "REM " first), e.g. your Dropbox or Google Drive folder:
REM set "CLOUD_ROOT=D:\Dropbox"

if not defined CLOUD_ROOT if defined OneDrive set "CLOUD_ROOT=%OneDrive%"
if not defined CLOUD_ROOT if exist "%USERPROFILE%\Dropbox" set "CLOUD_ROOT=%USERPROFILE%\Dropbox"
if not defined CLOUD_ROOT if exist "%USERPROFILE%\Google Drive" set "CLOUD_ROOT=%USERPROFILE%\Google Drive"

if not defined CLOUD_ROOT (
  echo(
  echo  Couldn't find OneDrive, Dropbox, or Google Drive on this PC.
  echo  Edit this file and set CLOUD_ROOT near the top to your cloud
  echo  folder's full path, then run it again.
  echo(
  pause
  goto :eof
)

set "CFB_USER_DATA_DIR=%CLOUD_ROOT%\CFB-Playtest-Data"
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"

echo(
echo  Cloud data folder (synced across your PCs):
echo    %CFB_USER_DATA_DIR%
echo(

REM ---- One-time migration ----------------------------------------
REM If this PC still has the old local data folder and the cloud one
REM doesn't exist yet, offer to copy it up so nothing is lost. The
REM local copy is left untouched as a backup.
if not exist "%CFB_USER_DATA_DIR%" if exist "%USERPROFILE%\CFB-Playtest-Data" (
  echo  Found your existing local data at:
  echo    %USERPROFILE%\CFB-Playtest-Data
  echo(
  choice /C YN /M "Copy it into the cloud folder now (recommended)"
  if errorlevel 2 goto :skipmigrate
  echo  Copying...
  xcopy "%USERPROFILE%\CFB-Playtest-Data" "%CFB_USER_DATA_DIR%" /E /I /H /Y >nul || goto :error
  echo  Done. Your local copy stays where it was as a backup.
  echo(
)
:skipmigrate

if not exist "node_modules" (
  echo  First run on this machine - installing packages, takes a few minutes...
  call npm install || goto :error
)

echo  Building the current code (fast after the first run)...
call npm run build || goto :error

echo  Launching Dynasty Hub on the cloud data folder...
echo  (Remember: close it and let the cloud finish syncing before
echo   opening on your other PC.)
".\node_modules\electron\dist\electron.exe" .
goto :eof

:error
echo(
echo  Something failed - fix the error above and try again.
pause
