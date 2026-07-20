const db = require('./database_pg');

async function fixTilde() {
    try {
        console.log("=== ACTUALIZANDO TIPOLOGIA DOCUMENTAL EN POSTGRESQL ===");
        
        // 1. Update DERECHO DE PETICION (avoid matching RESPUESTA)
        const resTyp1 = await db.pool.query(
            "UPDATE trd_typologies SET typology_name = 'DERECHO DE PETICION' WHERE typology_name ILIKE '%PETICI%N%' AND typology_name NOT ILIKE '%RESPUESTA%'"
        );
        console.log(`Filas DERECHO DE PETICION actualizadas en trd_typologies: ${resTyp1.rowCount}`);

        const resDoc1 = await db.pool.query(
            "UPDATE documents SET typology_name = 'DERECHO DE PETICION' WHERE typology_name ILIKE '%PETICI%N%' AND typology_name NOT ILIKE '%RESPUESTA%' AND filename NOT ILIKE '%RESPUESTA%'"
        );
        console.log(`Documentos DERECHO DE PETICION actualizados: ${resDoc1.rowCount}`);

        // 2. Update RESPUESTA A DERECHO DE PETICION
        const resTyp2 = await db.pool.query(
            "UPDATE trd_typologies SET typology_name = 'RESPUESTA A DERECHO DE PETICION' WHERE typology_name ILIKE '%RESPUESTA%PETICI%N%' OR (typology_name ILIKE '%RESPUESTA%' AND typology_name ILIKE '%PETICI%N%')"
        );
        console.log(`Filas RESPUESTA actualizadas en trd_typologies: ${resTyp2.rowCount}`);

        const resDoc2 = await db.pool.query(
            "UPDATE documents SET typology_name = 'RESPUESTA A DERECHO DE PETICION' WHERE (typology_name ILIKE '%RESPUESTA%PETICI%N%' OR (typology_name ILIKE '%RESPUESTA%' AND typology_name ILIKE '%PETICI%N%')) OR (filename ILIKE '%RESPUESTA%' AND (typology_name ILIKE '%PETICI%N%' OR typology_name = 'DERECHO DE PETICION'))"
        );
        console.log(`Documentos RESPUESTA actualizados: ${resDoc2.rowCount}`);
        
        console.log("=== PROCESO COMPLETADO EXITOSAMENTE ===");
    } catch (e) {
        console.error("Error actualizando la base de datos:", e);
    } finally {
        db.close();
    }
}

fixTilde();
