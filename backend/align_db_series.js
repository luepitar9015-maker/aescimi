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
        console.log("=== ALINEANDO CÓDIGOS DE SERIE (37 -> 68.9224.4-37) ===");
        await client.query("BEGIN");

        // 1. Actualizar expedientes con subserie = '37' a '68.9224.4-37'
        const resExp = await client.query(
            "UPDATE expedientes SET subserie = '68.9224.4-37' WHERE subserie = '37'"
        );
        console.log(`Actualizados ${resExp.rowCount} expedientes a la subserie '68.9224.4-37'.`);

        // 2. Actualizar documentos con trd_series_id = 17 a 37
        const resDoc = await client.query(
            "UPDATE documents SET trd_series_id = 37 WHERE trd_series_id = 17"
        );
        console.log(`Actualizados ${resDoc.rowCount} documentos al trd_series_id 37.`);

        await client.query("COMMIT");
        console.log("=== ALINEACIÓN COMPLETADA CON ÉXITO ===");
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Error en la alineación:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
