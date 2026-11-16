#!/bin/bash
echo "=========================================================="
echo "    DESCARGANDO Y ACTUALIZANDO DESDE GITHUB (LINUX)       "
echo "=========================================================="

echo "[1/5] Descargando la ultima actualizacion desde GitHub..."
git fetch origin main
git reset --hard origin/main

echo "[2/5] Preparando almacenamiento seguro para Chromium (/mnt/almacen/.puppeteer_tmp) y liberando /tmp..."
if [ -d "/mnt/almacen" ]; then
    mkdir -p /mnt/almacen/.puppeteer_tmp
    chmod 777 /mnt/almacen/.puppeteer_tmp
fi
rm -rf /tmp/puppeteer_dev_chrome_profile-* /tmp/puppeteer_aes_bot_* /tmp/.org.chromium.Chromium.* 2>/dev/null || true
pkill -9 -f 'puppeteer_aes_bot_' 2>/dev/null || true

if command -v apt-get >/dev/null 2>&1; then
    echo "[2.5/5] Verificando dependencias de Chrome/Puppeteer (Debian/Ubuntu)..."
    echo "Aut0m4t1z4d0r2026%*" | sudo -S apt-get update -y || true
    echo "Aut0m4t1z4d0r2026%*" | sudo -S apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxkbcommon0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils || true
fi

echo "[3/5] Actualizando dependencias del Backend..."
cd backend
npm install --no-audit --no-fund
cd ..

echo "[4/5] Usando Frontend precompilado en frontend/dist..."

echo "[5/5] Limpiando logs acumulados de PM2 y reiniciando servicios..."
pm2 flush || true
pm2 reload ecosystem.config.js --update-env || pm2 restart sena-backend --update-env || pm2 start ecosystem.config.js
pm2 save

echo "=========================================================="
echo "  ACTUALIZACION COMPLETADA CON EXITO (8GB RAM OPTIMIZADO) "
echo "=========================================================="
df -h / /mnt/almacen 2>/dev/null || true
free -h 2>/dev/null || true
