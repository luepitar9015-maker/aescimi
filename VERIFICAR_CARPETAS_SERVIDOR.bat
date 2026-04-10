@echo off
color 0E
echo ==========================================================
echo        VERIFICANDO CARPETAS EN EL SERVIDOR (MODO LOCAL)
echo ==========================================================
echo.
echo NOTA: El dominio aescimi.web-virtual.com esta rechazando la conexion en el puerto 22.
echo Como estas en la misma red, usaremos la IP local.
echo.
echo 1. Ve fisicamente al servidor Linux.
echo 2. Abre una terminal y escribe: ip address (o ifconfig) para ver su IP.
echo 3. Anota esa IP (ejemplo: 192.168.1.50)
echo.
set /p SERVIDOR_IP="Escribe la IP local de tu servidor Linux y presiona Enter: "
echo.
echo Te pedira tu contrasena (Aut0m4t1z4d0r2026%%*)
echo.
ssh cimi@%SERVIDOR_IP% "echo '===== CARPETAS EN TU SERVIDOR =====' && ls -l && echo ==================================="
echo.
echo Revisa arriba cual es el nombre de la carpeta (ej: INSTALADOR_SENA, aescimi, etc.)
echo.
pause
