@echo off
title Backend - Automatizador de Sistemas
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0backend"

:INICIO
echo.
echo ============================================
echo  BACKEND INICIANDO... [%date% %time%]
echo  (Si se cae, se reinicia automaticamente)
echo ============================================
echo.

:: Liberar puerto 3001 en caso de procesos huerfanos previos
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3001 ^| findstr LISTEN') do taskkill /f /pid %%a 2>nul

node auto_ssl.js
node server.js

echo.
echo [!] El backend se detuvo. Reiniciando en 3 segundos...
echo     Presiona CTRL+C para detener definitivamente.
echo.
timeout /t 3 /nobreak >nul
goto INICIO
