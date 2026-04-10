@echo off
color 0A
echo ==========================================================
echo        PREPARANDO ARCHIVOS PARA SERVIDOR LINUX
echo ==========================================================
echo.
echo Limpiando carpetas pesadas (node_modules)...
rmdir /s /q "backend\node_modules" 2>nul
rmdir /s /q "frontend\node_modules" 2>nul
rmdir /s /q "frontend\dist" 2>nul

echo.
echo ==========================================================
echo LISTO. 
echo Ahora puedes comprimir toda esta carpeta 'INSTALADOR_SENA'
echo en un archivo .zip y subirla a tu servidor Linux.
echo En el servidor Linux descomprime y ejecuta: bash deploy_linux.sh
echo ==========================================================
pause
