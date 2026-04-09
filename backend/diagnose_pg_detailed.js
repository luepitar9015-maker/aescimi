const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function diagnose() {
    console.log("--- DIAGNÓSTICO DE BASE DE DATOS (PostgreSQL) ---");
    try {
        const client = await pool.connect();
        console.log("✅ Conexión a PostgreSQL establecida.");

        // 1. Listar tablas
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("📋 Tablas encontradas:", tablesRes.rows.map(r => r.table_name).join(', '));

        // 2. Verificar Superuser
        const superuserRes = await client.query("SELECT id, full_name, email, document_no FROM users WHERE role = 'superadmin' LIMIT 1");
        if (superuserRes.rows.length > 0) {
            console.log("✅ Superusuario encontrado:", superuserRes.rows[0].full_name, `(${superuserRes.rows[0].email})`);
            console.log("🆔 Documento Superuser:", superuserRes.rows[0].document_no);
        } else {
            console.warn("⚠️ No se encontró superusuario con rol 'superadmin'.");
        }

        // 3. Verificar configuración del sistema (Expiración)
        const settingsRes = await client.query("SELECT value FROM system_settings WHERE key = 'system_expiration_date'");
        if (settingsRes.rows.length > 0) {
            const expDate = new Date(settingsRes.rows[0].value);
            const now = new Date();
            console.log("📅 Fecha de expiración del sistema:", expDate.toLocaleString());
            if (now > expDate) {
                console.warn("🔴 EL SISTEMA HA CADUCADO.");
            } else {
                console.log("🟢 El sistema está vigente.");
            }
        } else {
            console.warn("⚠️ No se encontró la configuración 'system_expiration_date'.");
        }

        // 4. Verificar integridad de TRD (opcional)
        const trdRes = await client.query("SELECT COUNT(*) FROM trd_series");
        console.log("📂 Cantidad de Series en TRD:", trdRes.rows[0].count);

        client.release();
    } catch (err) {
        console.error("❌ ERROR DURANTE EL DIAGNÓSTICO:", err.message);
    } finally {
        await pool.end();
    }
}

diagnose();
