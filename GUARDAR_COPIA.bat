@echo off
echo ===================================================
echo    GUARDANDO COPIA DE SEGURIDAD DEL SISTEMA AES
echo ===================================================
echo.

:: Crear carpeta de respaldos si no existe
if not exist "D:\copia del sistema sena\BACKUPS" (
    mkdir "D:\copia del sistema sena\BACKUPS"
)

:: Obtener fecha y hora para el nombre del archivo
for /f "tokens=1-3 delims=/" %%a in ("%date%") do (
    set DIA=%%a
    set MES=%%b
    set ANO=%%c
)
for /f "tokens=1-2 delims=:." %%a in ("%time%") do (
    set HORA=%%a
    set MIN=%%b
)

set HORA=%HORA: =0%
set TIMESTAMP=%ANO%-%MES%-%DIA%_%HORA%%MIN%

echo Copiando archivos del backend...
xcopy "D:\copia del sistema sena\backend" "D:\copia del sistema sena\BACKUPS\backend_%TIMESTAMP%" /E /I /Q /Y

echo.
echo Copiando archivos del frontend...
xcopy "D:\copia del sistema sena\frontend\src" "D:\copia del sistema sena\BACKUPS\frontend_src_%TIMESTAMP%" /E /I /Q /Y

echo.
echo ===================================================
echo    COPIA GUARDADA EXITOSAMENTE EN:
echo    D:\copia del sistema sena\BACKUPS\
echo    NOMBRE: backend_%TIMESTAMP%
echo ===================================================
echo.
pause
