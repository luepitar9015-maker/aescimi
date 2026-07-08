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
        console.log("=== BUSCANDO FICHAS EN TRD_SUBSERIES ===");
        const res = await client.query("SELECT id, subseries_code, subseries_name FROM trd_subseries WHERE subseries_code LIKE '%3410871%' OR subseries_code LIKE '%3433833%'");
        console.table(res.rows);
        
        console.log("=== BUSCANDO SERIES QUE CONTENGAN 37 ===");
        const resSer = await client.query("SELECT id, series_code, series_name FROM trd_series WHERE series_code LIKE '%37%'");
        console.table(resSer.rows);
        
        console.log("=== CONTANDO REGISTROS DE SUBSERIES ===");
        const countRes = await client.query("SELECT COUNT(*) FROM trd_subseries");
        console.log("Total subseries:", countRes.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
