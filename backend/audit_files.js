require('dotenv').config();
const { pool } = require('./database_pg');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        console.log("=== INICIANDO AUDITORÍA DE ENLACES DE ARCHIVOS ===");
        
        // 1. Obtener la ruta de almacenamiento configurada
        const settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'storage_path'");
        const storagePath = settingsRes.rows[0] ? settingsRes.rows[0].value : '/mnt/almacen';
        console.log("Ruta base de almacenamiento configurada:", storagePath);
        
        // 2. Consultar todos los documentos
        const res = await pool.query('SELECT id, filename, path, status FROM documents');
        const total = res.rows.length;
        console.log("Total de documentos registrados en la base de datos:", total);
        
        let validCount = 0;
        let brokenCount = 0;
        const brokenExamples = [];
        const pathPatterns = {};
        
        for (const doc of res.rows) {
            let docPath = doc.path;
            
            // Verificar si existe el archivo físicamente
            let exists = false;
            try {
                exists = fs.existsSync(docPath);
            } catch (e) {
                exists = false;
            }
            
            if (exists) {
                validCount++;
            } else {
                brokenCount++;
                
                // Analizar el patrón del path roto
                let patternType = 'Desconocido';
                if (!docPath) {
                    patternType = 'Ruta vacía';
                } else if (docPath.includes('\\')) {
                    patternType = 'Ruta con barras invertidas (estilo Windows)';
                } else if (docPath.startsWith('C:')) {
                    patternType = 'Ruta absoluta local de Windows (C:)';
                } else if (docPath.includes('OneDrive')) {
                    patternType = 'Ruta contiene OneDrive';
                } else if (docPath.startsWith('/mnt/almacen')) {
                    patternType = 'Ruta del servidor (/mnt/almacen) no encontrada en disco';
                }
                
                pathPatterns[patternType] = (pathPatterns[patternType] || 0) + 1;
                
                if (brokenExamples.length < 15) {
                    brokenExamples.push({
                        id: doc.id,
                        filename: doc.filename,
                        db_path: docPath,
                        status: doc.status,
                        pattern: patternType
                    });
                }
            }
        }
        
        console.log("\n=== RESULTADO DE LA VERIFICACIÓN DE ARCHIVOS ===");
        console.log(`Enlaces válidos (existen en disco): ${validCount} (${((validCount/total)*100).toFixed(2)}%)`);
        console.log(`Enlaces dañados (rotos/no encontrados): ${brokenCount} (${((brokenCount/total)*100).toFixed(2)}%)`);
        
        console.log("\n=== CLASIFICACIÓN DE ENLACES DAÑADOS ===");
        console.table(pathPatterns);
        
        if (brokenExamples.length > 0) {
            console.log("\n=== MUESTRA DE ENLACES DAÑADOS (Primeros 15) ===");
            console.table(brokenExamples);
        }
        
    } catch (e) {
        console.error("Error durante la auditoría:", e);
    } finally {
        await pool.end();
    }
}
run();
