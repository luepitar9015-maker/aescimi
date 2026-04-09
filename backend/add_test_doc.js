/**
 * Actualiza el expediente de prueba para que use el código de OnBase correcto.
 * Según el video, el robot debe digitar el formato "2025EX-XXXXXX" en OnBase.
 */
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres', host: 'localhost',
    database: 'sena_db', password: 'admin123', port: 5432,
});

async function run() {
    const client = await pool.connect();
    try {
        // Buscar un expediente que tenga código en formato OnBase (2025EX-XXXXXX)
        // y que el número al final sea 35881 (como se vio en el video: 2025EX-035881)
        const expRes = await client.query(
            `SELECT id, expediente_code, subserie, title FROM expedientes 
             WHERE expediente_code ILIKE '%2025EX%' 
             ORDER BY id ASC LIMIT 10`
        );
        
        if (expRes.rows.length === 0) {
            console.log('No hay expedientes con formato 2025EX-XXXXXX. Listando todos:');
            const all = await client.query("SELECT id, expediente_code FROM expedientes ORDER BY id DESC LIMIT 15");
            all.rows.forEach(r => console.log(`   [${r.id}] ${r.expediente_code}`));
            return;
        }

        console.log('Expedientes disponibles con formato OnBase:');
        expRes.rows.forEach(r => console.log(`   [${r.id}] ${r.expediente_code} | ${r.subserie || ''} | ${r.title || ''}`));

        // Usar el primero disponible (o cambie el índice si quiere otro)
        const exp = expRes.rows[0];
        console.log(`\n➡️  Usando expediente: ${exp.expediente_code} (ID=${exp.id})`);

        // Verificar si ya existe el documento de prueba
        const docRes = await client.query(
            "SELECT id, status, filename FROM documents WHERE expediente_id = $1",
            [exp.id]
        );

        if (docRes.rows.length > 0) {
            await client.query(
                "UPDATE documents SET status = 'Pendiente', ades_id = NULL WHERE expediente_id = $1",
                [exp.id]
            );
            console.log(`🔄 Documentos revertidos a Pendiente para expediente ${exp.expediente_code}`);
            docRes.rows.forEach(r => console.log(`   [${r.id}] ${r.filename}`));
        } else {
            const ins = await client.query(
                `INSERT INTO documents (expediente_id, filename, path, typology_name, status, document_date)
                 VALUES ($1, 'PRUEBA_ROBOT.pdf', 'C:\\Users\\Usuario\\Documents\\PRUEBA.pdf', 'DERECHO DE PETICION', 'Pendiente', NOW())
                 RETURNING id`,
                [exp.id]
            );
            console.log(`✅ Documento de prueba creado con ID=${ins.rows[0].id}`);
        }

        console.log(`\n🟢 Listo. El robot digitará "${exp.expediente_code}" en OnBase.`);
        console.log(`   Recargue la pantalla de Cargue AES con F5.`);

    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(console.error);
