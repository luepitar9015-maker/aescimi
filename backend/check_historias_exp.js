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
        console.log("=== EXPEDIENTES DE HISTORIAS ACADEMICAS EN BD ===");
        const res = await client.query("SELECT id, expediente_code, title, subserie, metadata_values FROM expedientes WHERE subserie = '68.9224.4-37' LIMIT 5");
        console.table(res.rows.map(r => ({
            ...r,
            metadata_values: JSON.stringify(r.metadata_values)
        })));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
