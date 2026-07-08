const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT COUNT(*) as count FROM expediente_assignments", [], (err, rows) => {
    if (err) {
        console.error("Error al consultar expediente_assignments en SQLite:", err.message);
    } else {
        console.log("Total de asignaciones en SQLite:", rows[0].count);
    }
    
    // Si hay registros, mostrar una muestra
    if (rows && rows[0].count > 0) {
        db.all("SELECT * FROM expediente_assignments LIMIT 5", [], (err, samples) => {
            if (!err) console.table(samples);
            db.close();
        });
    } else {
        db.close();
    }
});
