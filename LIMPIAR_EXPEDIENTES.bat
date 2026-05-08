@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║      LIMPIEZA TOTAL DE EXPEDIENTES - SENA V2         ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo ADVERTENCIA: Esta operacion eliminara TODOS los expedientes
echo y documentos creados en el sistema. Esta accion NO se puede deshacer.
echo.
set /p CONFIRMAR="¿Desea continuar? Escriba SI para confirmar: "
if /i NOT "%CONFIRMAR%"=="SI" (
    echo.
    echo Operacion cancelada por el usuario.
    echo.
    pause
    exit /b 0
)
echo.
echo Ejecutando limpieza...
echo.
cd /d "%~dp0backend"
node LIMPIAR_EXPEDIENTES.js
echo.
pause
