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
        console.log("=== DETALLE DE SERIE 97 ===");
        const res = await client.query("SELECT * FROM trd_series WHERE id = 97");
        console.table(res.rows);
        
        console.log("=== DETALLE DE SERIES TOTAL ===");
        const resAll = await client.query("SELECT id, series_code, series_name FROM trd_series");
        console.table(resAll.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
