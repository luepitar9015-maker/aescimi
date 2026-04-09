const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5432,
});

const EXPEDIENTE_CODE = '2025EX-035881';

async function run() {
    await client.connect();

    // Obtener columnas que existen en documents
    const colRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='documents'"
    );
    const cols = colRes.rows.map(r => r.column_name);
    console.log('[INFO] Columnas disponibles:', cols.join(', '));

    // Construir SET dinámicamente según columnas disponibles
    const setClauses = ["status = 'Pendiente'"];
    if (cols.includes('aes_imported'))   setClauses.push('aes_imported = false');
    if (cols.includes('aes_id'))         setClauses.push('aes_id = NULL');
    if (cols.includes('onbase_status'))  setClauses.push('onbase_status = NULL');
    if (cols.includes('last_aes_error')) setClauses.push('last_aes_error = NULL');
    if (cols.includes('onbase_sync_date')) setClauses.push('onbase_sync_date = NULL');

    const sql = `
        UPDATE documents 
        SET ${setClauses.join(', ')}
        WHERE expediente_id IN (
            SELECT id FROM expedientes WHERE expediente_code = $1
        )
    `;
    console.log('[SQL]', sql.replace(/\s+/g, ' ').trim());
    const res = await client.query(sql, [EXPEDIENTE_CODE]);
    console.log(`\n[OK] ${res.rowCount} documento(s) revertido(s) a estado Pendiente.`);
    await client.end();
}

run().catch(console.error);
