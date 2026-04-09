@echo off
echo --- INICIANDO AUTOMATIZADOR DE SISTEMAS ---
echo.
set "PATH=C:\Program Files\nodejs;%PATH%"

echo 1. Iniciando Backend con auto-reinicio...
start "Backend - Auto-Reinicio" cmd /k ""%~dp0INICIAR_BACKEND.bat""

timeout /t 3 /nobreak >nul

echo 2. Iniciando Interfaz...
cd /d "%~dp0frontend"
start "Frontend - Vite" cmd /k "npm run dev"

echo.
echo --- SISTEMA INICIADO ---
echo El backend se reinicia automaticamente si se cae.
echo Cierra las ventanas solo si quieres detener el sistema.
pause
