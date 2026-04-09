/**
 * Script de inicialización de system_settings en PostgreSQL
 * Uso: node scripts/init_settings.js
 * 
 * Crea la tabla si no existe e inserta las credenciales AES de OnBase.
 * Modifica los valores abajo antes de ejecutar.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

// ← MODIFIQUE ESTOS VALORES SEGÚN LAS CREDENCIALES DE ONBASE:
const SETTINGS = {
    ades_url: 'https://onbase.sena.edu.co/Onbase/Login.aspx',
    ades_username: 'JRROZO',
    ades_password: process.env.ADES_PASSWORD || '' // ← ponga la contraseña aquí o en .env como ADES_PASSWORD
};

async function main() {
    const client = await pool.connect();
    try {
        console.log('Conectado a PostgreSQL.');

        // 1. Crear tabla si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla system_settings verificada/creada.');

        // 2. Insertar/actualizar cada setting
        for (const [key, value] of Object.entries(SETTINGS)) {
            await client.query(
                `INSERT INTO system_settings (key, value)
                 VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
            const displayVal = key.includes('password') ? '*** (oculta)' : value;
            console.log(`  ✅ Setting "${key}" = "${displayVal}"`);
        }

        // 3. Verificar
        const { rows } = await client.query('SELECT key, value FROM system_settings');
        console.log('\nSettings actuales en BD:');
        rows.forEach(r => {
            const v = r.key.includes('password') ? '*** (oculta)' : r.value;
            console.log(`  ${r.key} = ${v}`);
        });

        console.log('\n✅ Listo. Las credenciales AES están guardadas en la base de datos.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
