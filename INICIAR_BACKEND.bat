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

node auto_ssl.js
node server.js

echo.
echo [!] El backend se detuvo. Reiniciando en 3 segundos...
echo     Presiona CTRL+C para detener definitivamente.
echo.
timeout /t 3 /nobreak >nul
goto INICIO
