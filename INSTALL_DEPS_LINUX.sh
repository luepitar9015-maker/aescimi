#!/bin/bash
echo "=========================================================="
echo "    INSTALANDO DEPENDENCIAS DE CHROME/PUPPETEER (LINUX)   "
echo "=========================================================="

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "Sistema operativo detectado: $OS"

if [ "$OS" = "rocky" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ] || [ "$OS" = "almalinux" ]; then
    echo "Instalando dependencias usando dnf (Rocky/RHEL)..."
    PACKAGES=(
        atk
        at-spi2-atk
        at-spi2-core
        libXcomposite
        libXcursor
        libXdamage
        libXext
        libXfixes
        libXi
        libXrandr
        libXrender
        libXtst
        alsa-lib
        mesa-libgbm
        pango
        cairo
        libxshmfence
        nss
        nspr
        libdrm
        libxkbcommon
    )
    for pkg in "${PACKAGES[@]}"; do
        echo "Instalando $pkg..."
        sudo dnf install -y "$pkg" || echo "⚠ No se pudo instalar $pkg"
    done
else
    echo "Instalando dependencias usando apt-get (Debian/Ubuntu)..."
    sudo apt-get update
    PACKAGES=(
        ca-certificates
        fonts-liberation
        libasound2
        libatk-bridge2.0-0
        libatk1.0-0
        libatk1.0-0t64
        libc6
        libcairo2
        libcups2
        libdbus-1-3
        libexpat1
        libfontconfig1
        libgbm1
        libgcc1
        libgconf-2-4
        libgdk-pixbuf2.0-0
        libglib2.0-0
        libgtk-3-0
        libnspr4
        libpango-1.0-0
        libpangocairo-1.0-0
        libstdc++6
        libx11-6
        libx11-xcb1
        libxkbcommon0
        libxcb1
        libxcomposite1
        libxcursor1
        libxdamage1
        libxext6
        libxfixes3
        libxi6
        libxrandr2
        libxrender1
        libxss1
        libxtst6
        lsb-release
        wget
        xdg-utils
    )
    for pkg in "${PACKAGES[@]}"; do
        echo "Instalando $pkg..."
        sudo apt-get install -y "$pkg" || echo "⚠ No se pudo instalar $pkg"
    done
fi

# Intento de autoinstalación oficial de Puppeteer como respaldo
echo "=== Intentando Puppeteer System Install como respaldo ==="
cd /home/cimi/aescimi/backend && npx puppeteer system install || echo "⚠ npx puppeteer system install falló"

echo "=========================================================="
echo "    INSTALACIÓN DE DEPENDENCIAS COMPLETADA                "
echo "=========================================================="
