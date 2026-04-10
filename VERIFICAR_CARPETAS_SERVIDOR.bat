@echo off
color 0E
echo ==========================================================
echo        VERIFICANDO CARPETAS EN EL SERVIDOR
echo ==========================================================
echo.
echo Te pedira tu contrasena (Aut0m4t1z4d0r2026%%*)
echo.
ssh cimi@aescimi.web-virtual.com "echo '===== CARPETAS EN TU SERVIDOR =====' && ls -l && echo ==================================="
echo.
echo Revisa arriba cual es el nombre de la carpeta (ej: INSTALADOR_SENA, aescimi, etc.)
echo.
pause
