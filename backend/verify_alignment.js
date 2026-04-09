const { pool } = require('./database_pg');

async function verify() {
    try {
        console.log("--- 1. Testing ILIKE Search ---");
        const resSearch = await pool.query("SELECT * FROM expedientes WHERE title ILIKE $1", ['%prueba%']);
        console.log(`Found ${resSearch.rowCount} expedientes matching 'prueba' (case-insensitive)`);

        console.log("\n--- 2. Testing Role Permissions ---");
        const resPerms = await pool.query("SELECT count(*) FROM role_permissions");
        console.log(`Found ${resPerms.rows[0].count} entries in role_permissions`);

        console.log("\n--- 3. Testing TRD Permissions Schema ---");
        const resTrdPerms = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_trd_permissions'");
        console.log(`Columns in user_trd_permissions: ${resTrdPerms.rows.map(r => r.column_name).join(', ')}`);

        console.log("\nVerification complete.");
    } catch (e) {
        console.error("Verification failed:", e.message);
    } finally {
        await pool.end();
    }
}

verify();
