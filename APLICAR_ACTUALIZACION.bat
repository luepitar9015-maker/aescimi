@echo off
color 0B
echo ==========================================================
echo        CONECTANDO AL SERVIDOR Y ACTUALIZANDO
echo ==========================================================
echo.
echo Hola! A continuacion te pedira tu contrasena.
echo Recuerda que la contrasena es: Aut0m4t1z4d0r2026%%*
echo (Al escribirla no se veran asteriscos, solo escribela y dale a Enter)
echo.

ssh -t cimi@aescimi.web-virtual.com "echo '1. Limpiando servicios del sistema viejo (por si quedaron de root)...' && sudo pm2 kill 2>/dev/null ; pm2 kill 2>/dev/null && echo '2. Ingresando al repositorio nuevo...' && cd ~/aescimi && echo '3. Ejecutando actualización y levantando todo...' && chmod +x ACTUALIZAR_DESDE_GITHUB_LINUX.sh && ./ACTUALIZAR_DESDE_GITHUB_LINUX.sh"

echo.
echo ==========================================================
echo TERMINADO. Observa los resultados arriba.
echo ==========================================================
pause
