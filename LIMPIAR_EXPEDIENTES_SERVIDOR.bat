@echo off
chcp 65001 >nul
color 0C
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     LIMPIEZA DE EXPEDIENTES EN SERVIDOR DE PRODUCCION        ║
echo ║              https://aescimi.web-virtual.com                 ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo ADVERTENCIA: Esta operacion eliminara TODOS los expedientes
echo del servidor de produccion. Esta accion NO se puede deshacer.
echo.
set /p CONFIRMAR="Escriba SI para confirmar: "
if /i NOT "%CONFIRMAR%"=="SI" (
    echo.
    echo Operacion cancelada.
    echo.
    pause
    exit /b 0
)

echo.
echo ══════════════════════════════════════════════════════════════
echo  PASO 1/3 - Subiendo script a GitHub...
echo ══════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"
git add backend/LIMPIAR_EXPEDIENTES.js LIMPIAR_EXPEDIENTES.bat LIMPIAR_EXPEDIENTES_SERVIDOR.bat
git commit -m "feat: agregar script LIMPIAR_EXPEDIENTES para eliminar expedientes y archivos del sistema"
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: No se pudo subir a GitHub. Verifica tu conexion a internet.
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════════════════════════
echo  PASO 2/3 - Conectando al servidor y descargando el script...
echo ══════════════════════════════════════════════════════════════
echo.
echo La contrasena del servidor es: Aut0m4t1z4d0r2026%%*
echo (Al escribirla no se veran asteriscos)
echo.

ssh -t cimi@aescimi.web-virtual.com "cd ~/aescimi && git pull origin main"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: No se pudo conectar al servidor o hacer git pull.
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════════════════════════
echo  PASO 3/3 - Ejecutando limpieza en el servidor...
echo ══════════════════════════════════════════════════════════════
echo.
echo La contrasena del servidor es: Aut0m4t1z4d0r2026%%*
echo.

ssh -t cimi@aescimi.web-virtual.com "cd ~/aescimi/backend && node LIMPIAR_EXPEDIENTES.js"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              PROCESO COMPLETADO                              ║
echo ║  Todos los expedientes del servidor fueron eliminados.       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
