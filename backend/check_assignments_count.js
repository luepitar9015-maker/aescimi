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
        console.log("=== RECUENTO DE ASIGNACIONES EN POSTGRES ===");
        const res = await client.query("SELECT COUNT(*) FROM expediente_assignments");
        console.log("Total filas en expediente_assignments:", res.rows[0].count);
        
        const sample = await client.query("SELECT * FROM expediente_assignments LIMIT 5");
        console.table(sample.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
