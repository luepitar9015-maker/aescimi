const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5432,
});

async function run() {
    await client.connect();
    console.log('✅ Conectado a la base de datos...');

    // Borrar en orden correcto (primero las que dependen de otras)
    const tablesToClear = [
        'documents',
        'expedientes',
        'trd_typologies',
        'trd_subseries',
        'trd_series',
        'organization_structure',
        'role_permissions',
        'user_trd_permissions',
    ];

    for (const table of tablesToClear) {
        try {
            const res = await client.query(`DELETE FROM ${table}`);
            console.log(`🗑️  ${table}: ${res.rowCount} registro(s) eliminado(s)`);
        } catch (e) {
            // Tabla puede no existir, la ignoramos
            if (e.code === '42P01') {
                console.log(`ℹ️  ${table}: no existe, se omite`);
            } else {
                console.log(`⚠️  ${table}: ${e.message}`);
            }
        }
    }

    console.log('\n✅ Base de datos depurada. Los usuarios siguen intactos.');
    await client.end();
}

run().catch(console.error);
