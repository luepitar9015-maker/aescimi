require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function main() {
    const client = await pool.connect();
    try {
        console.log("=== CORRIGIENDO PERMISOS DE USUARIOS (TRD) ===");
        await client.query("BEGIN");

        // 1. Mapeo de Series (ID Antiguo -> ID Nuevo)
        const seriesMap = {
            97: 37,  // HISTORIAS ACADEMICAS (68.9224.4-37)
            95: 35,  // DISENO CURRICULAR (68.9224.4-28)
            106: 46, // BANCO DE INSTRUMENTOS (68.9224.2-07)
            107: 47, // DERECHOS DE PETICION (68.9224.2-27)
            108: 48, // INFORMES (68.9224.2-42)
            109: 49  // PLANES (68.9224.2-53)
        };

        // 2. Mapeo de Subseries (ID Antiguo -> ID Nuevo)
        const subseriesMap = {
            158: 64, // INFORMES DE GESTION (68.9224.2-42.29)
            159: 65, // PLANES OFERTA ABIERTA (68.9224.2-53.38)
            160: 66, // PLANES OFERTA ESPECIAL COMPLEMENTARIA (68.9224.2-53.39)
            161: 67  // PLANES OFERTA ESPECIAL TITULADA (68.9224.2-53.40)
        };

        // Actualizar series_id
        for (const [oldId, newId] of Object.entries(seriesMap)) {
            const res = await client.query(
                "UPDATE user_trd_permissions SET series_id = $1 WHERE series_id = $2",
                [newId, parseInt(oldId, 10)]
            );
            console.log(`Actualizadas ${res.rowCount} filas de permisos de series: ID ${oldId} -> ID ${newId}`);
        }

        // Actualizar subseries_id
        for (const [oldId, newId] of Object.entries(subseriesMap)) {
            const res = await client.query(
                "UPDATE user_trd_permissions SET subseries_id = $1 WHERE subseries_id = $2",
                [newId, parseInt(oldId, 10)]
            );
            console.log(`Actualizadas ${res.rowCount} filas de permisos de subseries: ID ${oldId} -> ID ${newId}`);
        }

        // 3. Eliminar permisos huérfanos que apunten a IDs que no existen (para limpieza)
        const deleteSeriesRes = await client.query(
            "DELETE FROM user_trd_permissions WHERE series_id IS NOT NULL AND series_id NOT IN (SELECT id FROM trd_series)"
        );
        console.log(`Eliminados ${deleteSeriesRes.rowCount} registros de permisos de series huérfanos.`);

        const deleteSubseriesRes = await client.query(
            "DELETE FROM user_trd_permissions WHERE subseries_id IS NOT NULL AND subseries_id NOT IN (SELECT id FROM trd_subseries)"
        );
        console.log(`Eliminados ${deleteSubseriesRes.rowCount} registros de permisos de subseries huérfanos.`);

        await client.query("COMMIT");
        console.log("=== PROCESO DE CORRECCIÓN DE PERMISOS COMPLETADO ===");

    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Error corrigiendo permisos:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
