@echo off
if "%~1"=="RELAUNCHED" goto :main

rem Re-launch this same script completely hidden (no console window) so the
rem app's own splash screen is the first thing the user sees, instead of a
rem black cmd window sitting there during npm/webpack output. See
rem scripts\hidden-relaunch.vbs for why a .bat can't do this by itself.
wscript.exe "%~dp0scripts\hidden-relaunch.vbs" "%~f0"
exit /b 0

:main
cd /d "%~dp0"

rem hidden-relaunch.vbs already launched the pre-splash before this hidden
rem batch process even started. Clear any stale ready-flag from a previous
rem run first so this run's pre-splash doesn't close itself instantly;
rem main.ts writes it fresh once the real app window is ready.
set "READY_FLAG=%TEMP%\dynastyos-splash-ready.flag"
del "%READY_FLAG%" >nul 2>&1

set "LOGFILE=%TEMP%\dynastyos-launch.log"
del "%LOGFILE%" >nul 2>&1

if not exist "node_modules" (
  call npm install >>"%LOGFILE%" 2>&1
  if errorlevel 1 goto :failed
)

rem Skip the rebuild when nothing under src/ or the build config has changed
rem since the last build — the common case (just opening the app to check a
rem dynasty) then launches Electron directly, so the splash appears in about
rem a second instead of after a full 15-20s webpack rebuild.
rem NOTE: 'src' is scanned -Recurse on its own, then the individual config
rem files are checked WITHOUT -Recurse. Passing individual file paths into a
rem single -Recurse Get-ChildItem call triggers a PowerShell path-resolution
rem pathology that made this check take ~15s (measured) even when no rebuild
rem was needed — splitting them keeps it under ~0.5s.
set "NEEDS_BUILD=1"
if exist "dist\main\main.js" (
  powershell -NoProfile -Command "$distTime = (Get-Item 'dist\main\main.js').LastWriteTime; $srcMax = (Get-ChildItem -Recurse -File 'src' -ErrorAction SilentlyContinue | Measure-Object -Property LastWriteTime -Maximum).Maximum; $cfgMax = (Get-Item 'webpack.config.js','package.json','tsconfig.json' -ErrorAction SilentlyContinue | Measure-Object -Property LastWriteTime -Maximum).Maximum; $srcTime = if ($srcMax -gt $cfgMax) { $srcMax } else { $cfgMax }; if ($srcTime -and $srcTime -le $distTime) { exit 0 } else { exit 1 }"
  if not errorlevel 1 set "NEEDS_BUILD=0"
)

if "%NEEDS_BUILD%"=="1" (
  call npm run build >>"%LOGFILE%" 2>&1
  if errorlevel 1 goto :failed
)

set "USE_PRE_SPLASH_ONLY=1"
call npx electron . >>"%LOGFILE%" 2>&1
exit /b 0

:failed
rem A failure here means main.ts's own signalPreSplashReady() never ran (it
rem never got the chance to start) — close the pre-splash ourselves instead
rem of leaving it on screen for its full 30s safety timeout.
echo failed>"%READY_FLAG%"
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('DynastyOS failed to start. Opening the log file for details.', 'Launch Failed', 'OK', 'Error') | Out-Null"
start "" notepad "%LOGFILE%"
exit /b 1
