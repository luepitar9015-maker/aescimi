const fs = require('fs');
const path = require('path');
const db = require('./database_pg'); // Asegúrate de que usemos el módulo correcto de la BD

async function renameExpedienteDocs(searchValue) {
    console.log(`Iniciando proceso para renombrar documentos del expediente: ${searchValue}`);

    try {
        // 1. Encontrar el expediente
        const expedienteQuery = `
            SELECT e.*, 
                   sub.id as subseries_id, ser.id as series_id
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
            WHERE e.title LIKE $1 OR e.expediente_code LIKE $1
            LIMIT 1
        `;
        
        // Use wildcards just in case
        const likeParam = `%${searchValue}%`;
        const resultExp = await db.query(expedienteQuery, [likeParam]);
        const expediente = resultExp.rows && resultExp.rows.length > 0 ? resultExp.rows[0] : null;

        if (!expediente) {
            console.error(`❌ No se encontró ningún expediente asociado al valor: ${searchValue}`);
            process.exit(1);
        }

        console.log(`✅ Expediente encontrado: ID=${expediente.id}, Título=${expediente.title}, Código=${expediente.expediente_code}`);

        // 2. Obtener el orden de tipologías según TRD
        const getTypologyOrderMap = async (seriesId, subseriesId) => {
            let q, params;
            if (subseriesId) {
                q = "SELECT typology_name FROM trd_typologies WHERE subseries_id = $1 ORDER BY id ASC";
                params = [subseriesId];
            } else if (seriesId) {
                q = "SELECT typology_name FROM trd_typologies WHERE series_id = $1 ORDER BY id ASC";
                params = [seriesId];
            } else {
                return {};
            }
            
            const res = await db.query(q, params);
            const map = {};
            if (res.rows) {
                res.rows.forEach((r, idx) => {
                    map[r.typology_name] = idx + 1;
                });
            }
            return map;
        };

        const typologyOrderMap = await getTypologyOrderMap(expediente.series_id, expediente.subseries_id);
        console.log("📋 Orden de tipologías recuperado de TRD:", typologyOrderMap);

        // 3. Buscar documentos del expediente
        const docsQuery = "SELECT id, filename, path, typology_name FROM documents WHERE expediente_id = $1 ORDER BY id ASC";
        const resultDocs = await db.query(docsQuery, [expediente.id]);
        const docs = resultDocs.rows || [];

        if (docs.length === 0) {
            console.log("⚠️ No se encontraron documentos asociados a este expediente.");
            process.exit(0);
        }

        console.log(`Encontrados ${docs.length} documentos. Procediendo a renombrar...`);

        // 4. Renombrar
        const typologyCounts = {};

        for (const doc of docs) {
            const typName = doc.typology_name || 'Documento_General';
            typologyCounts[typName] = (typologyCounts[typName] || 0) + 1;
            const currentDocIndex = typologyCounts[typName];

            const safeName = typName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
            const trdOrder = typologyOrderMap[typName] || 99; // Fallback a 99 si no existe en la TRD
            const paddedOrder = String(trdOrder).padStart(2, '0');
            
            let newFilename;
            if (currentDocIndex > 1) {
                newFilename = `${paddedOrder}_${safeName}_${currentDocIndex}.pdf`;
            } else {
                newFilename = `${paddedOrder}_${safeName}.pdf`;
            }

            if (doc.filename === newFilename) {
                console.log(`➖ Documento ID ${doc.id} ya tiene el nombre correcto: ${newFilename}`);
                continue;
            }

            const oldPath = doc.path;
            const dir = path.dirname(oldPath);
            const newPath = path.join(dir, newFilename);

            // Renombrar en disco
            try {
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newPath);
                    console.log(`✅ Físico renombrado: ${doc.filename} -> ${newFilename}`);
                } else {
                    console.warn(`⚠️ Archivo físico no encontrado: ${oldPath}. Solo se actualizará BD.`);
                }
            } catch (err) {
                console.error(`❌ Error renombrando archivo físico ${oldPath}:`, err);
                continue; // Saltar actualización de BD si falla en disco
            }

            // Actualizar en base de datos
            try {
                await db.query("UPDATE documents SET filename = $1, path = $2 WHERE id = $3", [newFilename, newPath, doc.id]);
                console.log(`✅ Base de datos actualizada: Doc ID ${doc.id}`);
            } catch (err) {
                console.error(`❌ Error actualizando BD para doc ID ${doc.id}:`, err);
            }
        }

        console.log("\n🎉 Proceso de renombrado completado exitosamente.");

    } catch (error) {
        console.error("Error global:", error);
    } finally {
        // En pool local con query no necesitamos db.end() típicamente en Express, 
        // pero por si acaso, process.exit garantiza finalización.
        process.exit(0);
    }
}

// Tomar el valor del expediente de la consola (ej. 1120841880)
const searchExpediente = process.argv[2] || "1120841880";
renameExpedienteDocs(searchExpediente);
