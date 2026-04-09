const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI';

function walk(dir, depth = 0) {
    if (depth > 10) return;
    try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                console.log('  '.repeat(depth) + '📁 ' + file);
                walk(fullPath, depth + 1);
            } else {
                console.log('  '.repeat(depth) + '📄 ' + file);
            }
        });
    } catch (e) {
        console.error('Error reading dir:', dir, e.message);
    }
}

console.log('=== Contenido de OneDrive CIMI ===');
if (fs.existsSync(root)) {
    walk(root);
} else {
    console.log('La carpeta raíz no existe:', root);
}
