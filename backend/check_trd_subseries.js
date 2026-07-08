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
        console.log("=== LISTANDO SUBSERIES EN LA BD ===");
        const res = await client.query("SELECT id, series_id, subseries_code, subseries_name FROM trd_subseries LIMIT 30");
        console.table(res.rows);
        
        console.log("\n=== LISTANDO SERIES EN LA BD ===");
        const resSer = await client.query("SELECT id, dependency_id, series_code, series_name FROM trd_series LIMIT 10");
        console.table(resSer.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
