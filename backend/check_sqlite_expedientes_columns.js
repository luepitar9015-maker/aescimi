const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = "/home/cimi/aescimi/backend/database.sqlite";

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al abrir base de datos SQLite:", err.message);
        return;
    }
    console.log("Conectado a SQLite:", dbPath);
    
    // Obtener información de la tabla expedientes
    db.all("PRAGMA table_info(expedientes)", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log("=== COLUMNAS EN TABLA expedientes DE SQLITE ===");
        console.table(rows);
        
        // Consultar los primeros 10 expedientes de SQLite
        db.all("SELECT * FROM expedientes LIMIT 10", [], (err, expRows) => {
            if (err) {
                console.error(err.message);
                return;
            }
            console.log("=== MUESTRA DE DATOS DE expedientes EN SQLITE ===");
            console.table(expRows);
            db.close();
        });
    });
});
