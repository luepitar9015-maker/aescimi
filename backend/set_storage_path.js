/**
 * Script: set_storage_path.js
 * Propósito: Actualiza la ruta de almacenamiento en system_settings
 *            y migra todos los documentos guardados a la nueva ruta CIMI.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const NEW_STORAGE = 'C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI';

console.log('=== Configuración de Ruta de Almacenamiento CIMI ===\n');
console.log('Nueva ruta:', NEW_STORAGE);

// Verificar que la carpeta CIMI existe
if (!fs.existsSync(NEW_STORAGE)) {
    console.log('\n⚠️  La carpeta CIMI no existe en OneDrive. Creándola...');
    try {
        fs.mkdirSync(NEW_STORAGE, { recursive: true });
        console.log('✅ Carpeta CIMI creada.');
    } catch (err) {
        console.error('❌ Error al crear carpeta CIMI:', err.message);
        process.exit(1);
    }
} else {
    console.log('✅ Carpeta CIMI verificada en OneDrive.\n');
}

db.serialize(() => {

    // 1. Actualizar system_settings
    db.run(
        `INSERT INTO system_settings (key, value) VALUES ('storage_path', ?) 
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
        [NEW_STORAGE, NEW_STORAGE],
        function(err) {
            if (err) {
                console.error('❌ Error actualizando system_settings:', err.message);
            } else {
                console.log('✅ system_settings actualizado: storage_path =', NEW_STORAGE);
            }
        }
    );

    // 2. Leer todos los documentos con rutas antiguas
    db.all(`SELECT id, filename, path FROM documents WHERE path IS NOT NULL`, [], (err, rows) => {
        if (err) {
            console.error('❌ Error leyendo documentos:', err.message);
            db.close();
            return;
        }

        if (!rows || rows.length === 0) {
            console.log('\nℹ️  No hay documentos previos para migrar.');
            db.close();
            return;
        }

        console.log(`\n📂 Encontrados ${rows.length} documentos para evaluar...\n`);

        let migrated = 0;
        let skipped = 0;
        let errors = 0;
        let pending = rows.length;

        const done = () => {
            pending--;
            if (pending === 0) {
                console.log('\n=== Resumen de Migración ===');
                console.log(`✅ Migrados: ${migrated}`);
                console.log(`⏭️  Omitidos (ya en destino o no encontrados): ${skipped}`);
                console.log(`❌ Errores: ${errors}`);
                console.log('\n✅ Proceso completado. El sistema ahora guardará en CIMI.');
                db.close();
            }
        };

        rows.forEach(doc => {
            const oldPath = doc.path;

            // Si ya está en la nueva ruta, omitir
            if (oldPath && oldPath.startsWith(NEW_STORAGE)) {
                skipped++;
                done();
                return;
            }

            // Si el archivo no existe en la ruta antigua, solo actualizar BD
            if (!oldPath || !fs.existsSync(oldPath)) {
                skipped++;
                done();
                return;
            }

            // Construir nueva ruta manteniendo la estructura de carpetas relativa
            // Se detecta el segmento partir del primer subdirectorio tras la raíz antigua
            let relativePart = '';
            const knownRoots = [
                'C:\\SENA_STORAGE',
                path.join(__dirname, 'uploads', 'Gestion_Documental'),
                path.join(__dirname, 'uploads'),
            ];

            for (const root of knownRoots) {
                if (oldPath.startsWith(root)) {
                    relativePart = oldPath.substring(root.length).replace(/^[\\\/]/, '');
                    break;
                }
            }

            // Si no encontramos raíz conocida, usar solo el nombre de archivo
            if (!relativePart) {
                relativePart = path.basename(oldPath);
            }

            const newPath = path.join(NEW_STORAGE, relativePart);
            const newDir = path.dirname(newPath);

            try {
                // Crear directorio destino si no existe
                if (!fs.existsSync(newDir)) {
                    fs.mkdirSync(newDir, { recursive: true });
                }

                // Copiar archivo
                fs.copyFileSync(oldPath, newPath);

                // Actualizar ruta en BD
                db.run(
                    `UPDATE documents SET path = ? WHERE id = ?`,
                    [newPath, doc.id],
                    function(updateErr) {
                        if (updateErr) {
                            console.error(`  ❌ Error actualizando BD para doc ${doc.id}:`, updateErr.message);
                            errors++;
                        } else {
                            console.log(`  ✅ Migrado: ${doc.filename}`);
                            console.log(`     Antes: ${oldPath}`);
                            console.log(`     Ahora: ${newPath}`);
                            migrated++;
                            // Eliminar archivo original
                            try { fs.unlinkSync(oldPath); } catch(e) {}
                        }
                        done();
                    }
                );
            } catch (copyErr) {
                console.error(`  ❌ Error migrando ${doc.filename}:`, copyErr.message);
                errors++;
                done();
            }
        });
    });
});
