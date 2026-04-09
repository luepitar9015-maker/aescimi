@echo off
color 0A
echo ==========================================================
echo         INSTALADOR AUTOMATICO - SENA AES (NUEVO SERVIDOR)
echo ==========================================================
echo.
echo Este script preparara este nuevo PC para ser el servidor principal.
echo.
echo Requisitos previos:
echo 1. Debes haber instalado Node.js (v18 o superior)
echo 2. Debes haber instalado PostgreSQL (v14 o superior) con contrasena 'admin123'
echo 3. Debes haber instalado Google Chrome
echo.
pause

echo.
echo [1/3] Instalando dependencias de Node.js (Backend)...
cd "%~dp0backend"
call npm install

echo.
echo [2/3] Instalando dependencias de Node.js (Frontend)...
cd "%~dp0frontend"
call npm install

echo.
echo [3/3] Restaurando la Base de Datos desde el Backup...
echo Se pedira la contrasena de tu instalacion de PostgreSQL (digita: admin123)
cd "%~dp0"
set PGPASSWORD=admin123
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE sena_db;"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d sena_db -f "backup_bd_sena_migracion.sql"

echo.
echo ==========================================================
echo   INSTALACION COMPLETADA
echo ==========================================================
echo Ahora puedes arrancar el sistema usando ARRANCAR_SISTEMA.bat
echo Para que otros PCs se conecten a este, averigua tu IP local (ej: 192.168.1.X)
echo y edita la linea FRONTEND_URL en la carpeta backend/.env
echo.
pause
