require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

// MODIFIQUE LA CONTRASEÑA AQUI:
const PASSWORD = process.env.ADES_PASSWORD || 'PONGA_CONTRASENA_AQUI';

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla creada/verificada');

        const settings = [
            ['ades_url', 'https://onbase.sena.edu.co/Onbase/Login.aspx'],
            ['ades_username', 'JRROZO'],
            ['ades_password', PASSWORD]
        ];

        for (const [key, value] of settings) {
            await pool.query(
                `INSERT INTO system_settings (key, value)
                 VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
            const display = key.includes('pass') ? '***' : value;
            console.log(`✅ ${key} = ${display}`);
        }

        const result = await pool.query('SELECT key, value FROM system_settings');
        console.log('\nSettings en BD:');
        result.rows.forEach(r => {
            const v = r.key.includes('pass') ? '***' : r.value;
            console.log(`  ${r.key} = ${v}`);
        });

        console.log('\n✅ LISTO - Credenciales guardadas correctamente');
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    } finally {
        await pool.end();
    }
})();
