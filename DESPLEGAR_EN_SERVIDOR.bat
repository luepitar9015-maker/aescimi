@echo off
color 0B
echo ==========================================================
echo    ACTUALIZANDO SERVIDOR LINUX DESDE GITHUB
echo ==========================================================
echo.
echo La contrasena del servidor es: Automatizador2026*
echo (Copia la contrasena antes de continuar)
echo.
echo Conectando a cimi@aescimi.web-virtual.com...
echo.

ssh -t cimi@aescimi.web-virtual.com "cd ~/aescimi && bash ACTUALIZAR_DESDE_GITHUB_LINUX.sh"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Intentando con IP directa (192.168.8.165)...
    ssh -t cimi@192.168.8.165 "cd ~/aescimi && bash ACTUALIZAR_DESDE_GITHUB_LINUX.sh"
)

echo.
echo ==========================================================
echo PROCESO FINALIZADO
echo ==========================================================
pause
