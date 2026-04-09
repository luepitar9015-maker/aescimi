const db = require('./database');

db.all(`SELECT id, filename, status, load_date, ades_id FROM documents WHERE status = 'Cargado' ORDER BY load_date DESC LIMIT 10`, [], (e, r) => {
    if (e) console.log('Error:', e.message);
    else {
        console.log('Documentos con status Cargado:');
        console.log(JSON.stringify(r, null, 2));
    }
    process.exit(0);
});
