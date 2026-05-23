#!/bin/bash
echo "=========================================================="
echo "    DESCARGANDO Y ACTUALIZANDO DESDE GITHUB (LINUX)       "
echo "=========================================================="

echo "[1/4] Descargando la ultima actualizacion desde GitHub..."
git pull origin main

echo "[1.5/4] Instalando dependencias de Chrome/Puppeteer en el sistema..."
echo "Aut0m4t1z4d0r2026%*" | sudo -S apt-get update
echo "Aut0m4t1z4d0r2026%*" | sudo -S apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxkbcommon0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

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
