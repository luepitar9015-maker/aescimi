require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function countRecords() {
    let client;
    try {
        client = await pool.connect();
        console.log("Conectado exitosamente a la base de datos:", process.env.DB_NAME, "en", process.env.DB_HOST);
        
        // 1. Obtener la lista de tablas públicas
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        
        const tables = tablesRes.rows.map(r => r.table_name);
        const results = [];
        
        // 2. Contar registros por cada tabla
        for (const table of tables) {
            try {
                // Usamos comillas dobles para evitar problemas con nombres de tablas reservados
                const countRes = await client.query(`SELECT COUNT(*) AS total FROM "${table}"`);
                const total = parseInt(countRes.rows[0].total, 10);
                results.push({ Tabla: table, Registros: total });
            } catch (err) {
                results.push({ Tabla: table, Registros: `Error: ${err.message}` });
            }
        }
        
        console.log("\nResumen de registros en la base de datos:");
        console.table(results);
        
    } catch (err) {
        console.error("Error al conectar o consultar:", err.stack);
    } finally {
        if (client) releaseClient(client);
        await pool.end();
    }
}

function releaseClient(client) {
    try {
        client.release();
    } catch (e) {}
}

countRecords();
