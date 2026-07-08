const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = "/home/cimi/aescimi/backend/uploads";

if (fs.existsSync(UPLOADS_DIR)) {
    console.log("=== ARCHIVOS EN LA CARPETA UPLOADS DEL SERVIDOR ===");
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach(f => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, f));
        console.log(`${f} (${(stats.size / 1024).toFixed(2)} KB) - Modificado: ${stats.mtime.toLocaleString('es-CO')}`);
    });
} else {
    console.log("La carpeta uploads no existe en esta ruta.");
}
