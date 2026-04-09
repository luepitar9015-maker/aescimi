const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function addColumn() {
    try {
        await pool.query(`
            ALTER TABLE organization_structure 
            ADD COLUMN IF NOT EXISTS storage_path TEXT;
        `);
        console.log("Column 'storage_path' added to organization_structure successfully.");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

addColumn();
