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
        console.log("=== INSPECCIONANDO PAQUETES DE EXPEDIENTES ===");
        const res = await client.query("SELECT id, nombre, descripcion, user_id, created_by, created_at, estado FROM expediente_paquetes");
        console.table(res.rows);
        
        if (res.rows.length > 0) {
            console.log("\n=== CONTEO DE ITEMS POR PAQUETE ===");
            const itemsRes = await client.query("SELECT paquete_id, COUNT(*) as count FROM paquete_items GROUP BY paquete_id");
            console.table(itemsRes.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
