const db = require('./database');

db.run(`UPDATE documents SET status = 'Pendiente', ades_id = NULL, load_date = NULL WHERE status = 'Cargado'`, [], function (e) {
    if (e) console.log('Error:', e.message);
    else console.log(`OK: ${this.changes} documento(s) revertidos a Pendiente.`);
    process.exit(0);
});
