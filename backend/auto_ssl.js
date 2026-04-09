const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sslDir = path.join(__dirname, 'ssl');
const certPath = path.join(sslDir, 'cert.pem');
const keyPath = path.join(sslDir, 'key.pem');

// Create the directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
}

// Generate the certificate if they don't exist
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('\n===========================================');
    console.log('[SSL] Detectando configuracion segura HTTPS');
    console.log('===========================================');

    let success = false;
    try {
        console.log('[SSL] Intentando usar OpenSSL nativo (Rocky Linux / Bash)...');
        execSync(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "/CN=aescimi.web-virtual.com"`, { stdio: 'ignore' });
        console.log('[SSL] Exito! Certificado SSL generado con OpenSSL.');
        success = true;
    } catch (e) {
        console.log('[SSL] OpenSSL no disponible (probablemente Windows). Usando alternativa Node.js...');
    }

    if (!success) {
        try {
            console.log('[SSL] Instalando dependencia ligera para certificados...');
            // Install selfsigned temporarily
            execSync('npm install --no-save selfsigned', { stdio: 'ignore', cwd: __dirname });
            
            const selfsigned = require('selfsigned');
            const attrs = [{ name: 'commonName', value: 'localhost' }];
            const pems = selfsigned.generate(attrs, { days: 365 });
            
            fs.writeFileSync(keyPath, pems.private);
            fs.writeFileSync(certPath, pems.cert);
            console.log('[SSL] Exito! Certificado SSL generado para Windows.');
        } catch (err) {
            console.error('[SSL] Error critico al generar certificados genéricos.', err.message);
            console.log('[SSL] El sistema intentara arrancar en modo HTTP estandar.');
        }
    }
}
