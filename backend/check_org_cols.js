const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5432,
});

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'organization_structure'
            ORDER BY ordinal_position;
        `);
        console.log("Columns in organization_structure:");
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
