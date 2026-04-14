/**
 * Script: rebuild_storage_hierarchy.js
 * Propósito: Reorganiza físicamente los archivos en la unidad de almacenamiento
 *            aplicando la jerarquía TRD configurada para TODOS los documentos
 *            históricos, usando la NUEVA lógica exacta de documents.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function run() {
    console.log('=== Iniciando Reconstrucción Definitiva de Jerarquía TRD ===\n');

    try {
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
        
        let hierarchy = [];
        try {
            hierarchy = globalHierarchyConfig ? JSON.parse(globalHierarchyConfig) : [];
        } catch (e) { hierarchy = []; }

        if (hierarchy.length === 0) {
            console.log('⚠ No hay folder_hierarchy configurado. Usando fallback por defecto.');
            hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'sub' }, { type: 'meta_1' }];
        }

        const query = `
            SELECT 
                d.id as doc_id, d.filename, d.path as old_path, d.typology_name,
                t.document_type_value as typology_value,
                e.title as exp_title, e.metadata_values as exp_metadata,
                sub.subseries_code, sub.subseries_name,
                ser.series_code, ser.series_name,
                org.section_code, org.subsection_code, org.regional_code, org.center_code
            FROM documents d
            LEFT JOIN expedientes e ON d.expediente_id = e.id
            LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
            LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
            LEFT JOIN organization_structure org ON d.organization_id = org.id
            LEFT JOIN trd_typologies t ON d.typology_name = t.typology_name
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

        const getCleanSuffix = (fullCode, separator) => {
            if (!fullCode) return '';
            const parts = String(fullCode).split(separator);
            return parts[parts.length - 1].replace(/[.-]/g, '');
        };

        for (const row of rows) {
            const docId = row.doc_id;
            const filename = row.filename;
            const oldPath = row.old_path;

            if (!oldPath || !fs.existsSync(oldPath)) {
                console.log(`  [Doc ID: ${docId}] ⚠ Ignorado: No se encontró archivo físico en ${oldPath}`);
                skipCount++;
                continue;
            }

            let metaValues = {};
            try {
                metaValues = typeof row.exp_metadata === 'string'
                    ? JSON.parse(row.exp_metadata || '{}')
                    : (row.exp_metadata || {});
            } catch (e) { metaValues = {}; }

            const regCode = row.regional_code || '68';
            const ctrCode = row.center_code || '9224';
            const serieSuffix = getCleanSuffix(row.series_code, '-');
            const subserieSuffix = getCleanSuffix(row.subseries_code, '.');

            const pathLevels = hierarchy.map(level => {
                let value = '';
                const type = level.type;

                if (type === 'reg') value = regCode;
                else if (type === 'ctr') value = ctrCode;
                else if (type === 'dep') value = row.section_code || row.subsection_code || 'DEP';
                else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
                else if (type === 'ser') value = row.series_code || 'SERIE';
                else if (type === 'ser_name') value = row.series_name || 'SERIE';
                else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
                else if (type === 'sub') value = row.subseries_code || 'SUBSERIE';
                else if (type === 'sub_name') value = row.subseries_name || 'SUBSERIE';
                else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
                else if (type === 'typ_val') value = String(row.typology_value || '');
                else if (type === 'meta_1') value = row.exp_title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
                else if (type.startsWith('meta_')) {
                    const idx = type.split('_')[1];
                    value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '';
                }
                
                // CLEANING: Misma lógica exacta que documents.js para consistencia
                return String(value || '')
                    .replace(/[.-]/g, '') // Quitar puntos y guiones
                    .replace(/[<>:"/\\|?*]/g, '') 
                    .trim();
            });

            const validLevels = pathLevels.filter(v => v.trim() !== '');
            const newDir = path.join(globalStoragePath, ...validLevels);
            const newPath = path.join(newDir, filename);

            if (path.resolve(oldPath) === path.resolve(newPath)) {
                skipCount++;
                continue;
            }

            try {
                if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

                let finalNewPath = newPath;
                if (fs.existsSync(finalNewPath) && path.resolve(finalNewPath) !== path.resolve(oldPath)) {
                    finalNewPath = path.join(newDir, `${Date.now()}_${filename}`);
                }

                fs.copyFileSync(oldPath, finalNewPath);
                
                await new Promise((resolve, reject) => {
                    db.run("UPDATE documents SET path = ? WHERE id = ?", [finalNewPath, docId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                try { fs.unlinkSync(oldPath); } catch (e) {}

                console.log(`  ✅ [Doc ID: ${docId}] Movido a: /${validLevels.join('/')}/`);
                movedCount++;
            } catch (err) {
                console.error(`  ❌ [Doc ID: ${docId}] Error moviendo archivo:`, err.message);
                errorCount++;
            }
        }

        console.log('\n=== Resumen Reconstrucción ===');
        console.log(`✅ Archivos Reubicados en nueva jerarquía TRD: ${movedCount}`);
        console.log(`⏭ Archivos Ya Correctos / Sin Cambios: ${skipCount}`);
        console.log(`❌ Errores: ${errorCount}`);

    } catch (err) {
        console.error('\n❌ Error Crítico:', err.message);
    } finally {
        db.close();
    }
}

run();
