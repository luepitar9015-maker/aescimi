const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3005;

// Servir la carpeta public del frontend de forma estática
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Rutas explícitas para las diapositivas nuevas
app.get('/diapositivas', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/diapositivas.html'));
});
app.get('/diapositivas.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/diapositivas.html'));
});

// Rutas explícitas para la presentación anterior
app.get('/presentacion', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/presentacion.html'));
});
app.get('/presentacion.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/presentacion.html'));
});

// Servir el archivo diapositivas.html por defecto ante cualquier otra ruta
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/diapositivas.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[PRESENTACION] ✅ Servidor independiente corriendo en http://0.0.0.0:${port}`);
});
