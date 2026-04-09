/**
 * Script: rebuild_storage_hierarchy.js
 * Propósito: Reorganiza físicamente los archivos en la unidad de almacenamiento
 *            aplicando la jerarquía TRD configurada para todos los documentos.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function run() {
    console.log('=== Iniciando Reconstrucción de Jerarquía TRD ===\n');

    try {
        // 1. Obtener Configuración Global
        const getSetting = (key) => new Promise((resolve) => {
            db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => {
                if (err || !row) resolve(null);
                else resolve(row.value);
            });
        });

        const globalStoragePath = await getSetting('storage_path');
        const globalHierarchyConfig = await getSetting('folder_hierarchy');

        if (!globalStoragePath) {
            console.error('❌ Error: storage_path no configurado en la base de datos.');
            process.exit(1);
        }

        console.log('Ruta Base:', globalStoragePath);
        console.log('Jerarquía Configurada:', globalHierarchyConfig || 'Default');

        let hierarchy = [];
        try {
            hierarchy = globalHierarchyConfig ? JSON.parse(globalHierarchyConfig) : [
                { type: 'dep' }, { type: 'ser' }, { type: 'sub' }, { type: 'meta_1' }
            ];
        } catch (e) {
            hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'sub' }, { type: 'meta_1' }];
        }

        // 2. Obtener todos los documentos con su información relacionada
        const query = `
            SELECT 
                d.id as doc_id, d.filename, d.path as old_path, d.typology_name,
                e.title as exp_title, e.metadata_values as exp_metadata,
                sub.subseries_code, ser.series_code,
                org.section_code, org.subsection_code
            FROM documents d
            LEFT JOIN expedientes e ON d.expediente_id = e.id
            LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
            LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
            LEFT JOIN organization_structure org ON d.organization_id = org.id
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`\n📄 Procesando ${rows.length} documentos...\n`);

        let movedCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const row of rows) {
            const docId = row.doc_id;
            const filename = row.filename;
            const oldPath = row.old_path;

            if (!oldPath || !fs.existsSync(oldPath)) {
                console.log(`  [${docId}] ⚠ No se encontró archivo físico en: ${oldPath || 'NULL'}`);
                skipCount++;
                continue;
            }

            // Calcular Nueva Ruta Dinámica
            let metaValues = {};
            try {
                metaValues = typeof row.exp_metadata === 'string'
                    ? JSON.parse(row.exp_metadata || '{}')
                    : (row.exp_metadata || {});
            } catch (e) { metaValues = {}; }

            const pathLevels = hierarchy.map((level, i) => {
                let value = '';
                const type = level.type;
                
                if (type === 'dep') {
                    value = row.subsection_code || row.section_code || '';
                } else if (type === 'ser') {
                    value = row.series_code || '';
                } else if (type === 'sub') {
                    value = row.subseries_code || '';
                } else if (type === 'meta_1') {
                    value = row.exp_title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
                } else if (type.startsWith('meta_')) {
                    const metaIdx = parseInt(type.split('_')[1]);
                    value = metaValues[`valor${metaIdx}`] || metaValues[`Metadato ${metaIdx}`] || '';
                }
                
                const safeValue = String(value).replace(/[<>:"/\\|?*]/g, '').trim() || `nivel${i+1}`;
                return safeValue;
            });

            const newDir = path.join(globalStoragePath, ...pathLevels);
            const newPath = path.join(newDir, filename);

            // Si ya está en la posición correcta, omitir
            if (path.resolve(oldPath) === path.resolve(newPath)) {
                skipCount++;
                continue;
            }

            try {
                if (!fs.existsSync(newDir)) {
                    fs.mkdirSync(newDir, { recursive: true });
                }

                // Si hay colisión de nombres en destino, agregar prefijo
                let finalNewPath = newPath;
                if (fs.existsSync(finalNewPath) && path.resolve(finalNewPath) !== path.resolve(oldPath)) {
                    finalNewPath = path.join(newDir, `${Date.now()}_${filename}`);
                }

                fs.copyFileSync(oldPath, finalNewPath);
                
                // Actualizar DB
                await new Promise((resolve, reject) => {
                    db.run("UPDATE documents SET path = ? WHERE id = ?", [finalNewPath, docId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Eliminar antiguo
                try { fs.unlinkSync(oldPath); } catch (e) {}

                console.log(`  ✅ [${docId}] Reubicado: ${filename}`);
                movedCount++;
            } catch (err) {
                console.error(`  ❌ [${docId}] Error moviendo ${filename}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n=== Resumen Reconstrucción ===');
        console.log(`✅ Archivos Reubicados: ${movedCount}`);
        console.log(`⏭ Archivos Ya Correctos/No Encontrados: ${skipCount}`);
        console.log(`❌ Errores: ${errorCount}`);

    } catch (err) {
        console.error('\n❌ Error Crítico:', err.message);
    } finally {
        db.close();
    }
}

run();
