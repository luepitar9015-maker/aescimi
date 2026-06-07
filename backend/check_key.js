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

async function check() {
    try {
        console.log("=== CHECKING GEMINI API KEY IN DATABASE ===");
        const result = await pool.query("SELECT key, value, updated_at FROM system_settings WHERE key = 'gemini_api_key'");
        if (result.rows.length === 0) {
            console.log("❌ gemini_api_key NOT FOUND in system_settings table.");
        } else {
            const row = result.rows[0];
            const val = row.value || '';
            console.log(`✅ key found: '${row.key}'`);
            console.log(`✅ updated_at: ${row.updated_at}`);
            console.log(`✅ value length: ${val.length}`);
            if (val.length > 0) {
                console.log(`✅ value starts with: '${val.substring(0, 4)}...' and ends with: '...${val.substring(val.length - 4)}'`);
            } else {
                console.log("❌ value is empty!");
            }
        }
        
        console.log("=== CHECKING ENV VARIABLE ===");
        const envVal = process.env.GEMINI_API_KEY || '';
        console.log(`✅ process.env.GEMINI_API_KEY length: ${envVal.length}`);
        if (envVal.length > 0) {
            console.log(`✅ process.env.GEMINI_API_KEY starts with: '${envVal.substring(0, 4)}...'`);
        } else {
            console.log("❌ process.env.GEMINI_API_KEY is empty!");
        }
    } catch (e) {
        console.error("❌ Error checking database key:", e.message);
    } finally {
        pool.end();
    }
}
check();
