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

ssh cimi@aescimi.web-virtual.com "echo 'Conexion Exitosa' && cd ~/aescimi && git pull origin main && cd frontend && npm install && npm run build && cd ../backend && npm install && pm2 restart sena-backend && echo '¡ACTUALIZACION EXITOSA!'"

echo.
echo ==========================================================
echo TERMINADO. Observa los resultados arriba.
echo ==========================================================
pause
