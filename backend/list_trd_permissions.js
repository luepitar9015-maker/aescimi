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
        console.log("=== PERMISOS DE TRD POR USUARIO ===");
        const res = await client.query(`
            SELECT utp.*, u.full_name, s.series_name, sub.subseries_name
            FROM user_trd_permissions utp
            INNER JOIN users u ON u.id = utp.user_id
            LEFT JOIN trd_series s ON s.id = utp.series_id
            LEFT JOIN trd_subseries sub ON sub.id = utp.subseries_id
            LIMIT 40
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
