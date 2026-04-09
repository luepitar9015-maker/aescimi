const db = require('./database_pg');

db.pool.query(`
    SELECT filename, expediente_id, typology_name, COUNT(*) as cnt,
           STRING_AGG(id::text, ',' ORDER BY id) as ids,
           STRING_AGG(status, ',' ORDER BY id) as statuses
    FROM documents
    GROUP BY filename, expediente_id, typology_name
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
`, (e, r) => {
    if (e) console.log('Error:', e.message);
    else {
        console.log('Duplicados:');
        console.log(JSON.stringify(r.rows, null, 2));
    }
    process.exit(0);
});
