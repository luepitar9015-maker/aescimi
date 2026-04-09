@echo off
chcp 65001 > nul
echo =====================================================
echo    MIGRANDO DATOS AL NUEVO SISTEMA POSTGRESQL
echo =====================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0backend"

echo Ejecutando migracion...
echo.
node migrate_to_pg.js

echo.
echo =====================================================
echo Migracion completada. Ahora podra ver todos sus 
echo expedientes y documentos en la plataforma principal.
echo =====================================================
echo.
pause
