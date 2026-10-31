@echo off
REM ============================================================
REM  Isolated playtest instance of CFB 27 Dynasty Hub.
REM  Runs the CURRENT dev build (all coach-journey changes) with
REM  a SEPARATE app-data folder, so nothing here touches your
REM  real archive. Delete the data folder any time to reset.
REM
REM  Your GAME saves are never modified (the app only reads them).
REM ============================================================
setlocal
set "CFB_USER_DATA_DIR=%USERPROFILE%\CFB-Playtest-Data"
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"

echo(
echo  Isolated playtest data folder:
echo    %CFB_USER_DATA_DIR%
echo(

REM A fresh clone has no node_modules, and `npm run build` can't find
REM webpack without it — install once here so the playtest works on a
REM brand-new machine the same as Launch DynastyOS.bat does.
if not exist "node_modules" (
  echo  First run on this machine - installing packages, takes a few minutes...
  call npm install || goto :error
)

echo  Building the current code (fast after the first run)...
call npm run build || goto :error

echo  Launching isolated Dynasty Hub...
".\node_modules\electron\dist\electron.exe" .
goto :eof

:error
echo(
echo  Build failed - fix the error above and try again.
pause
