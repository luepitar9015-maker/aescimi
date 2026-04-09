const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function checkExpedientes() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'expedientes'
            ORDER BY ordinal_position;
        `);
        console.log("Columns in expedientes:");
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkExpedientes();
