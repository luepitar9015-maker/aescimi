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
        const codes = [
            '68.9224.2-53.39',
            '68.9224.2-42.29',
            '68.9224.2-53.38',
            '68.9224.2-53.40'
        ];
        
        console.log("=== BUSCANDO IDS NUEVOS PARA SUBSERIES ===");
        const res = await client.query("SELECT id, subseries_code, subseries_name FROM trd_subseries WHERE subseries_code = ANY($1)", [codes]);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
