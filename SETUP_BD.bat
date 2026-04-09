@echo off
chcp 65001 > nul
echo =====================================================
echo    CONFIGURANDO BASE DE DATOS SENA_DB
echo =====================================================
echo.

set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;C:\Program Files\PostgreSQL\15\bin;%PATH%"

cd /d "%~dp0backend"

echo Ejecutando setup de base de datos...
echo.
node setup_db.js

echo.
echo =====================================================
echo Si no hubo errores, reinicie los servidores:
echo Ejecute REINICIAR_SERVIDORES.bat
echo =====================================================
echo.
pause
