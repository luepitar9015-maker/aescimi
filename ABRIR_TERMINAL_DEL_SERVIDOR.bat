@echo off
color 0B
echo ==========================================================
echo        CONSOLA DIRECTA AL SERVIDOR LINUX
echo ==========================================================
echo.
echo Vamos a entrar a la consola para pegar los comandos de GitHub.
echo.
set /p SERVIDOR_IP="1. Escribe la IP local de tu servidor (ej: 192.168.1.50) y da Enter: "
echo.
echo 2. Te pedira tu contrasena (Aut0m4t1z4d0r2026%%*) - ¡Recuerda que no se ven los asteriscos!
echo.
echo 3. Una vez adentro, pega con "clic derecho" los comandos de GitHub.
echo.
ssh cimi@%SERVIDOR_IP%
pause
