@echo off
color 0A
echo ==========================================================
echo        SUBIENDO NUEVA ACTUALIZACION A GITHUB
echo ==========================================================
echo.
echo [1/3] Preparando los archivos modificados...
git add .

echo.
echo [2/3] Creando punto de guardado (Commit)...
git commit -m "Corrección en la creación de carpetas de backup y arreglo en el ordenamiento de tipologías de la TRD"

echo.
echo [3/3] Subiendo cambios a GitHub... (Esto puede tomar un momento dependiendo de tu conexion)
git push origin main

echo.
echo ==========================================================
echo SUBIDA A GITHUB COMPLETADA
echo ==========================================================
echo Ahora debes entrar a tu servidor Linux y descargar esta actualización.
pause
