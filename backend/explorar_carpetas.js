// Solo módulos nativos de Node.js - sin dependencias externas
const fs   = require('fs');
const path = require('path');

// ── Leer .env manualmente ──────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) env[key.trim()] = rest.join('=').trim();
    });
}

// ── Árbol de carpetas ──────────────────────────────────────────────────────
function listTree(dir, prefix = '', depth = 0) {
    if (depth > 8 || !fs.existsSync(dir)) return;
    let items;
    try { items = fs.readdirSync(dir).sort(); } catch(e) { return; }
    if (items.length === 0) {
        console.log(prefix + '  (carpeta vacía)');
        return;
    }
    items.forEach((item, idx) => {
        const fullPath = path.join(dir, item);
        const isLast   = idx === items.length - 1;
        const conn     = isLast ? '└── ' : '├── ';
        let stat;
        try { stat = fs.statSync(fullPath); } catch(e) { return; }
        if (stat.isDirectory()) {
            console.log(prefix + conn + '[DIR]  ' + item + '/');
            listTree(fullPath, prefix + (isLast ? '     ' : '│    '), depth + 1);
        } else {
            const kb = (stat.size / 1024).toFixed(1);
            console.log(prefix + conn + '[FILE] ' + item + '  (' + kb + ' KB)');
        }
    });
}

// ── Main ───────────────────────────────────────────────────────────────────
const storagePath = env['STORAGE_PATH']
    || path.join(__dirname, 'uploads', 'Gestion_Documental');

console.log('');
console.log('══════════════════════════════════════════════════');
console.log('        EXPLORADOR DE CARPETAS Y ARCHIVOS         ');
console.log('══════════════════════════════════════════════════');
console.log('Ruta base: ' + storagePath);
console.log('');

if (!fs.existsSync(storagePath)) {
    console.log('⚠  La carpeta NO existe en disco.');
    console.log('   Verifica storage_path en la BD o que se hayan subido documentos.');
} else {
    const items = fs.readdirSync(storagePath);
    if (items.length === 0) {
        console.log('   La carpeta existe pero está VACÍA.');
    } else {
        listTree(storagePath);
    }
}

// ── También revisar la carpeta uploads/temp ────────────────────────────────
const tempPath = path.join(__dirname, 'uploads', 'temp');
console.log('');
console.log('──────────────────────────────────────────────────');
console.log('Carpeta temporal (uploads/temp):');
if (fs.existsSync(tempPath)) {
    const tempItems = fs.readdirSync(tempPath);
    if (tempItems.length === 0) {
        console.log('   (vacía - OK)');
    } else {
        console.log('   ARCHIVOS TEMPORALES SIN LIMPIAR: ' + tempItems.length);
        tempItems.forEach(f => console.log('   - ' + f));
    }
} else {
    console.log('   No existe todavía.');
}

// ── Revisar carpeta uploads raíz ───────────────────────────────────────────
const uploadsPath = path.join(__dirname, 'uploads');
console.log('');
console.log('──────────────────────────────────────────────────');
console.log('Carpeta uploads/ (completa):');
if (fs.existsSync(uploadsPath)) {
    listTree(uploadsPath);
} else {
    console.log('   No existe.');
}

console.log('');
console.log('══════════════════════════════════════════════════');
console.log('AVISO: Para ver los documentos en BD ejecuta el');
console.log('servidor principal y consulta: GET /api/documents');
console.log('══════════════════════════════════════════════════');
console.log('');
