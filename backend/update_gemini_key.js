const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function updateKey() {
    try {
        const newKey = process.argv[2] || process.env.GEMINI_API_KEY;
        if (!newKey || newKey.trim().length === 0) {
            console.error("❌ Error: No se proporcionó ninguna clave. Úsala de la siguiente manera:");
            console.error("   node backend/update_gemini_key.js MI_CLAVE_GEMINI");
            console.error("   O configúrala en el archivo .env como GEMINI_API_KEY");
            return;
        }

        await pool.query(
            `INSERT INTO system_settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) 
             DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            ['gemini_api_key', newKey.trim()]
        );
        console.log("✅ Gemini API Key actualizada correctamente en la base de datos PostgreSQL.");
    } catch (e) {
        console.error("❌ Error al actualizar la API Key en la base de datos:", e.message);
    } finally {
        pool.end();
    }
}

updateKey();
