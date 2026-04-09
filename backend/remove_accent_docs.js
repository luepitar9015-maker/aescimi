const db = require('./database_pg');

db.pool.query(`
    UPDATE documents
    SET typology_name = REPLACE(typology_name, 'Ó', 'O')
    WHERE typology_name ILIKE '%PETICIÓ%' OR typology_name ILIKE '%PETICIO%';
`, (e, r) => {
    if (e) {
        console.log('Error:', e.message);
    } else {
        console.log(`OK: Tilde eliminada. ${r.rowCount} documentos actualizados en la tabla documents.`);
    }
    process.exit(0);
});
