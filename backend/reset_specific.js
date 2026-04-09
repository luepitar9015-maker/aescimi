const db = require('./database_pg');

db.pool.query(`
    UPDATE documents
    SET status = 'Pendiente', ades_id = NULL, load_date = NULL
    WHERE id = 2
`, (e, r) => {
    if (e) {
        console.log('Error:', e.message);
    } else {
        console.log(`OK: Documento ID 2 revertido a Pendiente exitosamente.`);
    }
    process.exit(0);
});
