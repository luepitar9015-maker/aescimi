#!/bin/bash
echo "=========================================================="
echo "    INSTALADOR AUTOMATICO - SENA AES (LINUX SERVIDOR)     "
echo "=========================================================="

echo "[1/4] Instalando PM2, Serve y dependencias globales..."
npm install -g pm2 serve

echo "[2/4] Instalando dependencias del Backend..."
cd backend
npm install
cd ..

echo "[3/4] Instalando dependencias del Frontend y compilando..."
cd frontend
npm install
npm run build
cd ..

echo "[4/4] Levantando servicios con PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "=========================================================="
echo "  INSTALACION COMPLETADA EN LINUX                         "
echo "=========================================================="
echo "Backend y Frontend ejecutándose en segundo plano."
