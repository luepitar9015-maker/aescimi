// Limpieza total de carpetas y archivos de prueba
// Solo módulos nativos - sin dependencias externas
const fs   = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');

// ── Eliminar carpeta recursivamente ────────────────────────────────────────
function deleteFolder(folderPath) {
    if (!fs.existsSync(folderPath)) return;
    fs.readdirSync(folderPath).forEach(item => {
        const fullPath = path.join(folderPath, item);
        if (fs.statSync(fullPath).isDirectory()) {
            deleteFolder(fullPath);
        } else {
            fs.unlinkSync(fullPath);
            console.log('  [ELIMINADO] ' + fullPath);
        }
    });
    fs.rmdirSync(folderPath);
    console.log('  [CARPETA ELIMINADA] ' + folderPath);
}

// ── Eliminar archivos sueltos en una carpeta (no subcarpetas) ──────────────
function deleteLoseFiles(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(item => {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
            console.log('  [ELIMINADO] ' + fullPath);
        }
    });
}

console.log('');
console.log('══════════════════════════════════════════════════');
console.log('         LIMPIEZA DE ARCHIVOS Y CARPETAS          ');
console.log('══════════════════════════════════════════════════');
console.log('');

// 1. Eliminar Gestion_Documental completa
const gdPath = path.join(uploadsDir, 'Gestion_Documental');
if (fs.existsSync(gdPath)) {
    console.log('>>> Eliminando Gestion_Documental/...');
    deleteFolder(gdPath);
    console.log('');
} else {
    console.log('>>> Gestion_Documental/ no existe, OK.');
}

// 2. Limpiar carpeta temp
const tempPath = path.join(uploadsDir, 'temp');
if (fs.existsSync(tempPath)) {
    console.log('>>> Limpiando uploads/temp/...');
    deleteLoseFiles(tempPath);
    console.log('');
} else {
    console.log('>>> uploads/temp/ no existe, OK.');
}

// 3. Limpiar archivos sueltos en raíz de uploads/
console.log('>>> Limpiando archivos sueltos en uploads/...');
deleteLoseFiles(uploadsDir);
console.log('');

console.log('══════════════════════════════════════════════════');
console.log('  LIMPIEZA DE DISCO COMPLETADA');
console.log('══════════════════════════════════════════════════');
console.log('');
console.log('IMPORTANTE: Tambien debes limpiar los registros');
console.log('de la base de datos. Ejecuta en PostgreSQL:');
console.log('');
console.log('  DELETE FROM documents;');
console.log('');
console.log('O desde psql:');
console.log('  psql -U postgres -d sena_db -c "DELETE FROM documents;"');
console.log('══════════════════════════════════════════════════');
console.log('');
