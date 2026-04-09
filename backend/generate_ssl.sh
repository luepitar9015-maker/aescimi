#!/bin/bash

# Este script genera un certificado SSL autofirmado para su uso en Node.js (Rocky Linux o similar)
# El certificado se guardará en la carpeta "ssl" dentro del backend.

# Crear carpeta ssl si no existe
mkdir -p ssl

echo "Generando certificado SSL autofirmado (se requerirá que acepte la advertencia en su navegador)..."

# Generar la llave y el certificado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=CO/ST=Bogota/L=Bogota/O=Organizacion/OU=IT/CN=$(hostname)"

echo "--------------------------------------------------------"
echo "¡Certificado generado exitosamente en la carpeta 'ssl'!"
echo "- ssl/key.pem"
echo "- ssl/cert.pem"
echo "--------------------------------------------------------"
echo "Ahora, al iniciar el servidor Node.js (npm start o node server.js), el sistema detectará"
echo "los certificados y arrancará automáticamente en modo HTTPS."
