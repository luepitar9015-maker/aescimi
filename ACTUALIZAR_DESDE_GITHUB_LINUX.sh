#!/bin/bash
echo "=========================================================="
echo "    DESCARGANDO Y ACTUALIZANDO DESDE GITHUB (LINUX)       "
echo "=========================================================="

echo "[1/4] Descargando la ultima actualizacion desde GitHub..."
git pull origin main

echo "[2/4] Actualizando dependencias del Backend..."
cd backend
npm install
cd ..

echo "[3/4] Instalando dependencias del Frontend y compilando..."
cd frontend
npm install
npm run build
cd ..

echo "[4/4] Reiniciando servicios en segundo plano..."
# Si PM2 ya está instalado y ejecutando la app, solo la reiniciamos. Si no, la iniciamos.
pm2 restart all || pm2 start ecosystem.config.js
pm2 save

echo "=========================================================="
echo "  ACTUALIZACION COMPLETADA CON EXITO                      "
echo "=========================================================="
echo "El servidor ha sido actualizado con los cambios de GitHub."
