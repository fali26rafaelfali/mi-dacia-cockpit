@echo off
title Cockpit Dacia - servidor local
cd /d "%~dp0"

REM Cierra servidores anteriores de este cockpit para evitar que se mezclen
REM FastAPI y el listado de directorios de http.server en el mismo puerto.
powershell -NoProfile -Command "$listeners = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; foreach ($listener in $listeners) { $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess); if ($process.CommandLine -match 'servidor-cockpit\.py|http\.server 8000') { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 1 /nobreak >nul

echo ============================================
echo   COCKPIT DACIA - servidor local
echo ============================================
echo.
echo Abriendo el cockpit en el navegador...
echo Direccion: http://localhost:8000/
echo.
echo NO CIERRES esta ventana negra mientras uses el cockpit.
echo Para apagar el servidor: cierra esta ventana.
echo.

REM Espera 1 segundo y abre el navegador
timeout /t 1 /nobreak >nul
start "" "http://localhost:8000/"

REM Arranca el servidor (archivos + incidencias DGT)
python servidor-cockpit.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor del cockpit.
  echo Revisa que Python, FastAPI y Uvicorn esten instalados.
  pause
)
