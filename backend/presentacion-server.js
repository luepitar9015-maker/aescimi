const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3005;

// Servir la carpeta public del frontend de forma estática
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Servir el archivo PRESENTACION_SENA.html ante cualquier ruta
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/PRESENTACION_SENA.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[PRESENTACION] ✅ Servidor independiente corriendo en http://0.0.0.0:${port}`);
});
