@echo off
echo ===========================================
echo SOLUCIONANDO PROBLEMA DE LA TILDE EN PETICION
echo ===========================================
cd /d "%~dp0backend"
node quitar_tilde.js
echo.
echo ===========================================
echo Finalizado. Presiona cualquier tecla para salir...
echo y luego recarga la ventana interaz (F5).
echo ===========================================
pause
