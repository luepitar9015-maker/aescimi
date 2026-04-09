const pool = require('./database_pg').pool;

async function resetSequences() {
    const tables = [
        'users', 'organization_structure', 'trd_series', 'trd_subseries', 
        'trd_typologies', 'documents', 'expedientes', 'system_settings', 'role_permissions'
    ];

    try {
        for (const table of tables) {
            console.log(`Resetting sequence for ${table}...`);
            await pool.query(`
                SELECT setval(
                    pg_get_serial_sequence('${table}', 'id'),
                    COALESCE(MAX(id), 1)
                ) FROM ${table}
            `);
        }
        console.log("Sequences reset successfully.");
    } catch (e) {
        console.error("Error resetting sequences:", e.message);
    } finally {
        pool.end();
    }
}

resetSequences();
