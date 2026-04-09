/**
 * Script: cleanup_onedrive_folders.js
 * Propósito: Elimina carpetas vacías o con nombres genéricos ("nivel1", "nivel2", "Sin Título")
 *            que hayan quedado tras la reestructuración a códigos TRD.
 */

const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI';

function isGeneric(name) {
    const genericNames = ['nivel1', 'nivel2', 'nivel3', 'nivel4', 'Sin Título', 'SIN_TITULO', 'DEP_SIN_CODIGO', 'SERIE_SIN_CODIGO', 'SUBSERIE_SIN_CODIGO'];
    return genericNames.some(g => name.toLowerCase().includes(g.toLowerCase()));
}

function removeEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) return;

    let files = fs.readdirSync(dir);
    if (files.length > 0) {
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            removeEmptyDirs(fullPath);
        });
        // Refetch files after cleaning subdirs
        files = fs.readdirSync(dir);
    }

    // Si la carpeta está vacía y es genérica o está vacía tras limpiar subcarpetas
    if (files.length === 0 && dir !== root) {
        try {
            console.log(`🗑 Eliminando carpeta vacía: ${dir}`);
            fs.rmdirSync(dir);
        } catch (e) {
            console.error(`❌ Error eliminando ${dir}:`, e.message);
        }
    }
}

console.log('=== Iniciando Limpieza de Carpetas en OneDrive ===');
if (fs.existsSync(root)) {
    removeEmptyDirs(root);
    console.log('✅ Limpieza completada.');
} else {
    console.log('La carpeta raíz no existe:', root);
}
