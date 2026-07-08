require('dotenv').config();
const { pool } = require('./database_pg');
async function run() {
    try {
        const res = await pool.query('SELECT id, series_id, subseries_code, subseries_name FROM trd_subseries LIMIT 15');
        console.log("=== MUESTRA DE SUBSERIES ===");
        console.table(res.rows);
    } catch (e) {
        console.error("Error querying subseries:", e);
    } finally {
        await pool.end();
    }
}
run();
