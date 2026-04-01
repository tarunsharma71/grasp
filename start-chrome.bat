@echo off
echo ===================================================
echo   Grasp - Starting Chrome with Remote Debug Port
echo ===================================================
echo.

:: Step 1: Check port 9222 and verify browser has visible tabs
:: Edge/Chrome keeps background processes alive after closing all windows,
:: leaving port 9222 occupied by zombie processes - a bare port check is not enough.
powershell -NoProfile -Command "try { $r=[System.Net.WebRequest]::Create('http://localhost:9222/json'); $r.Timeout=5000; $s=New-Object IO.StreamReader($r.GetResponse().GetResponseStream()); $j=$s.ReadToEnd(); $s.Close(); if($j -match '\"type\":\s*\"page\"'){exit 0}else{exit 1} } catch { exit 2 }"

if %errorlevel%==0 (
  echo [OK] Grasp Chrome is already running. Ready!
  goto :done
)
if %errorlevel%==2 goto :find_chrome

:: Port responds but no visible page tabs - stale background processes
echo [*] Browser closed but background processes still running. Cleaning up...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*chrome-grasp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo [OK] Stale processes cleaned.
echo.

:: Step 2: Find Chrome or Edge executable
:find_chrome
set "CHROME_EXE="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
  goto :found
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  goto :found
)

if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
  set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  goto :found
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  set "CHROME_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  goto :found
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  set "CHROME_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  goto :found
)

echo [ERROR] Chrome/Edge not found. Please install Chrome or Edge, or set CHROME_EXE manually.
pause
exit /b 1

:found
echo [OK] Found Chrome: %CHROME_EXE%
echo [*] Starting Grasp Chrome (dedicated profile)...
echo.

:: Step 3: Launch Chrome with remote debugging
start "" "%CHROME_EXE%" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\chrome-grasp" --no-first-run --no-default-browser-check --start-maximized

:: Step 4: Wait for port to be ready (max 30 seconds)
echo [*] Waiting for Chrome to be ready...
powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){Start-Sleep 1;try{$r=[System.Net.WebRequest]::Create('http://localhost:9222/json/version');$r.Timeout=5000;$null=$r.GetResponse();exit 0}catch{}}; exit 1"

if errorlevel 1 (
  echo [ERROR] Chrome did not start in time.
  pause
  exit /b 1
)

:: Step 5: Success
echo [OK] Grasp Chrome is ready!
echo.
echo NOTE: This is a dedicated browser window for AI control.
echo       First time? Please log in to your accounts here - logins are saved permanently.

:done
echo.
pause
