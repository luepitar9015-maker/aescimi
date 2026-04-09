const db = require('./database_pg');

async function fixTilde() {
    try {
        console.log("=== ACTUALIZANDO TIPOLOGIA DOCUMENTAL EN POSTGRESQL ===");
        const result = await db.pool.query(
            "UPDATE trd_typologies SET typology_name = 'DERECHO DE PETICION' WHERE typology_name ILIKE '%PETICI%N%'"
        );
        console.log(`Filas actualizadas en trd_typologies: ${result.rowCount}`);

        const resultDocs = await db.pool.query(
            "UPDATE documents SET typology_name = 'DERECHO DE PETICION' WHERE typology_name ILIKE '%PETICI%N%'"
        );
        console.log(`Documentos actualizados con el nuevo tipo: ${resultDocs.rowCount}`);
        
        console.log("=== PROCESO COMPLETADO EXITOSAMENTE ===");
    } catch (e) {
        console.error("Error actualizando la base de datos:", e);
    } finally {
        db.close();
    }
}

fixTilde();
