const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function addCol() {
    try {
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS origen VARCHAR(50) DEFAULT 'DIGITALIZADO'`);
        console.log("Columna 'origen' añadida con éxito a la tabla 'documents'.");
    } catch (e) {
        console.error("Error al añadir la columna:", e);
    } finally {
        pool.end();
    }
}

addCol();
