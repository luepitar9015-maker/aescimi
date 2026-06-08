@echo off
color 0A
echo ==========================================================
echo        SUBIENDO NUEVA ACTUALIZACION A GITHUB
echo ==========================================================
echo.
echo [1/4] Compilando el Frontend localmente (Vite)...
cd /d "%~dp0frontend"
call npm run build
cd /d "%~dp0"

echo.
echo [2/4] Preparando los archivos modificados...
git add .

echo.
echo [3/4] Creando punto de guardado (Commit)...
set "commit_msg="
set /p commit_msg="Escribe la descripcion de los cambios (presiona Enter para usar default): "
if "%commit_msg%"=="" set commit_msg="Actualizacion automatica con frontend compilado"

git commit -m "%commit_msg%"

echo.
echo [4/4] Subiendo cambios a GitHub... (Esto puede tomar un momento)
git push origin main

echo.
echo ==========================================================
echo SUBIDA A GITHUB COMPLETADA
echo ==========================================================
echo Ahora puedes ir a tu servidor Linux y aplicar la actualizacion.
pause
