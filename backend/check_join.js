const db = require('./database_pg');

// Check how many rows result from the pending query
db.pool.query(`
    SELECT d.id, d.filename, d.typology_name, COUNT(t.id) as typology_matches
    FROM documents d
    JOIN expedientes e ON d.expediente_id = e.id
    LEFT JOIN trd_typologies t ON d.typology_name = t.typology_name
    WHERE d.status = 'Pendiente'
    GROUP BY d.id, d.filename, d.typology_name
    ORDER BY d.id
`, (e, r) => {
    if (e) console.log('Error:', e.message);
    else {
        console.log('Documentos pendientes (matches check):');
        r.rows.forEach(row => console.log(`ID:${row.id} - "${row.filename}" - typology: "${row.typology_name}" - t_matches: ${row.typology_matches}`));
    }
    process.exit(0);
});
