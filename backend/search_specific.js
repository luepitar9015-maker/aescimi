const db = require('./database_pg');

const targetExpediente = '2025EX-035880';

db.pool.query(`
    SELECT d.id, e.expediente_code, d.typology_name, d.status
    FROM documents d
    JOIN expedientes e ON d.expediente_id = e.id
    WHERE e.expediente_code = $1
`, [targetExpediente], (e, r) => {
    if (e) {
        console.log('Error:', e.message);
    } else {
        console.log(`Búsqueda para ${targetExpediente}:`);
        console.log(JSON.stringify(r.rows, null, 2));
    }
    process.exit(0);
});
