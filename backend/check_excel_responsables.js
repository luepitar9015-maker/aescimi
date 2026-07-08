const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DOWNLOADS_DIR = "C:\\Users\\Usuario\\Downloads";

function checkExcelFiles() {
    console.log("=== ANALIZANDO PLANTILLAS EXCEL CON NODE.JS ===");
    
    if (!fs.existsSync(DOWNLOADS_DIR)) {
        console.error("El directorio de descargas no existe.");
        return;
    }

    const files = fs.readdirSync(DOWNLOADS_DIR)
        .filter(f => f.startsWith("Plantilla_Creacion_Expedientes") && f.endsWith(".xlsx"))
        .map(f => {
            const fullPath = path.join(DOWNLOADS_DIR, f);
            const stats = fs.statSync(fullPath);
            return { name: f, path: fullPath, mtime: stats.mtime };
        });

    // Ordenar de más reciente a más antiguo
    files.sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
        console.log("No se encontraron plantillas Excel en Downloads.");
        return;
    }

    // Analizar las 10 más recientes
    files.slice(0, 10).forEach(file => {
        console.log(`\nArchivo: ${file.name} (Modificado: ${file.mtime.toLocaleString('es-CO')})`);
        try {
            const workbook = XLSX.readFile(file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                console.log("El archivo está vacío.");
                return;
            }

            // Buscar la clave de la columna de responsable
            const firstRow = jsonData[0];
            let respColKey = null;
            for (const key of Object.keys(firstRow)) {
                const k = key.trim().toLowerCase();
                if (['responsable', 'asignado a', 'asignadoa', 'responsables', 'asignado'].includes(k)) {
                    respColKey = key;
                    break;
                }
            }

            if (respColKey) {
                const values = new Set();
                jsonData.forEach(row => {
                    if (row[respColKey]) {
                        values.add(String(row[respColKey]).trim());
                    }
                });
                console.log("Nombres de Responsable encontrados en el Excel:");
                values.forEach(v => console.log(`  - "${v}"`));
            } else {
                console.log("No se encontró columna 'Responsable'. Columnas de la fila 1:");
                console.log(Object.keys(firstRow));
            }
        } catch (e) {
            console.error("Error al procesar archivo:", e.message);
        }
    });
}

checkExcelFiles();
