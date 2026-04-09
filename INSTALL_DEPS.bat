@echo off
echo --- INSTALANDO DEPENDENCIAS (SENA) ---
echo.
set "PATH=C:\Program Files\nodejs;%PATH%"

echo 1. Instalando Backend...
cd /d "%~dp0backend"
call npm install
echo.

echo 2. Instalando Frontend...
cd /d "%~dp0frontend"
call npm install
echo.

echo --- PROCESO COMPLETADO ---
echo Ya puedes volver a abrir ARRANCAR_SISTEMA.bat
pause
