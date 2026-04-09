/**
 * Script: rebuild_all_expedientes_folders.js
 * Propósito: Asegura que TODOS los expedientes en la base de datos tengan
 *            su estructura de carpetas correcta en OneDrive (CIMI)
 *            utilizando la nomenclatura solicitada:
 *            Dependencia (Cód) > Serie (Cód) > Metadato (Valor)
 *            SIN PREFIJOS "nivel" o "CARPETA".
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function run() {
    console.log('=== Iniciando Reconstrucción Total de Carpetas en OneDrive (Nomenclatura Limpia) ===\n');

    try {
        // Helper to get system setting
        const getSystemSetting = (key) => new Promise((resolve) => {
            db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => {
                if (err || !row) resolve(null);
                else resolve(row.value);
            });
        });

        const globalStoragePath = await getSystemSetting('storage_path');
        const globalHierarchyConfig = await getSystemSetting('folder_hierarchy');

        if (!globalStoragePath) {
            console.error('❌ Error: storage_path no configurado en la base de datos.');
            process.exit(1);
        }

        console.log('Ruta Base:', globalStoragePath);

        // 2. Obtener TODOS los expedientes con su info de TRD
        const queryExp = `
            SELECT 
                e.id, e.expediente_code, e.title, e.metadata_values, e.subserie as subserie_val,
                sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
                ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                org.section_code, org.subsection_code, org.subsection_name, org.section_name,
                org.regional_code, org.center_code
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie = sub.subseries_name)
            LEFT JOIN trd_series ser ON sub.series_id = ser.id
            LEFT JOIN organization_structure org ON ser.dependency_id = org.id
        `;

        const expedientes = await new Promise((resolve, reject) => {
            db.all(queryExp, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📁 Procesando ${expedientes.length} expedientes de la base de datos...\n`);

        let createdFolders = 0;
        let movedDocs = 0;

        for (const exp of expedientes) {
            let metaValues = {};
            try {
                metaValues = typeof exp.metadata_values === 'string'
                    ? JSON.parse(exp.metadata_values || '{}')
                    : (exp.metadata_values || {});
            } catch (e) { metaValues = {}; }

            // Get hierarchy for this specific expediente
            let hierarchy = [];
            try {
                const raw = exp.sub_hierarchy || exp.ser_hierarchy || globalHierarchyConfig;
                hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
            } catch (e) { hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }]; }

            // Fetch typology mapping for the first document of this expediente
            const typologyValue = await new Promise((resolve) => {
                const q = `
                    SELECT t.document_type_value 
                    FROM documents d 
                    JOIN trd_typologies t ON d.typology_name = t.typology_name 
                    WHERE d.expediente_id = ? 
                    LIMIT 1
                `;
                db.get(q, [exp.id], (err, row) => {
                    resolve(row?.document_type_value || null);
                });
            });

            // Construct Path following hierarchy
            const getCleanSuffix = (fullCode, separator) => {
                if (!fullCode) return '';
                const parts = String(fullCode).split(separator);
                return parts[parts.length - 1].replace(/[.-]/g, '');
            };

            const regCode = exp.regional_code || '68';
            const ctrCode = exp.center_code || '9224';
            const serieSuffix = getCleanSuffix(exp.series_code, '-');
            const subserieSuffix = getCleanSuffix(exp.subseries_code, '.');

            const pathLevels = hierarchy.map(level => {
                let value = '';
                const type = level.type;
                if (type === 'reg') value = regCode;
                else if (type === 'ctr') value = ctrCode;
                else if (type === 'dep') value = exp.section_code || exp.subsection_code || 'DEP';
                else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
                else if (type === 'ser') value = exp.series_name || 'SERIE';
                else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
                else if (type === 'sub') value = exp.subseries_name || 'SUBSERIE';
                else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
                else if (type === 'meta_4' || type === 'typ_val') {
                    value = (type === 'meta_4' && metaValues['valor4']) ? metaValues['valor4'] : String(typologyValue || '4');
                }
                else if (type === 'meta_1') value = exp.title || metaValues['valor1'] || 'Expediente';
                else if (type.startsWith('meta_')) {
                    const idx = type.split('_')[1];
                    value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`];
                }
                return String(value || 'Sin_Nombre').replace(/[<>:"/\\|?*]/g, '').trim();
            });

            const expDir = path.join(globalStoragePath, ...pathLevels);
            
            // Crear carpeta si no existe
            if (!fs.existsSync(expDir)) {
                fs.mkdirSync(expDir, { recursive: true });
                console.log(`  🆕 Carpeta Creada: ${pathLevels.join(' > ')}`);
                createdFolders++;
            }

            // 3. Mover Documentos asociados a este expediente a esta nueva ruta
            const docs = await new Promise((resolve, reject) => {
                db.all("SELECT id, filename, path FROM documents WHERE expediente_id = ?", [exp.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            for (const doc of docs) {
                const oldPath = doc.path;
                const newPath = path.join(expDir, doc.filename);

                // Si oldPath contiene "nivel" o "CARPETA" o es distinto a NewPath, MOVER
                if (oldPath && fs.existsSync(oldPath) && path.resolve(oldPath) !== path.resolve(newPath)) {
                    try {
                        let finalPath = newPath;
                        if (fs.existsSync(finalPath)) {
                            finalPath = path.join(expDir, `${Date.now()}_${doc.filename}`);
                        }

                        fs.copyFileSync(oldPath, finalPath);
                        
                        await new Promise((resolve, reject) => {
                            db.run("UPDATE documents SET path = ? WHERE id = ?", [finalPath, doc.id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });

                        fs.unlinkSync(oldPath);
                        console.log(`    📄 Archivo Reubicado: ${doc.filename}`);
                        movedDocs++;
                    } catch (err) {
                        console.error(`    ❌ Error moviendo documento ${doc.id}:`, err.message);
                    }
                }
            }
        }

        console.log('\n=== RESUMEN FINAL ===');
        console.log(`Expedientes evaluados: ${expedientes.length}`);
        console.log(`Carpetas aseguradas: ${createdFolders}`);
        console.log(`Documentos reubicados: ${movedDocs}`);
        console.log('✅ Proceso completado.');

    } catch (err) {
        console.error('❌ Error Crítico:', err.message);
    } finally {
        db.close();
    }
}

run();
