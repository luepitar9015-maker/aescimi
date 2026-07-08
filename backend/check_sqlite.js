const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening local SQLite database:', err.message);
        return;
    }
    console.log('Successfully opened local SQLite database:', dbPath);
    
    // Obtener todas las tablas
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
        if (err) {
            console.error('Error querying sqlite master:', err.message);
            return;
        }
        
        console.log('Tables in SQLite:', tables.map(t => t.name));
        
        // Contar registros de cada tabla
        tables.forEach((tableObj) => {
            const table = tableObj.name;
            db.get(`SELECT COUNT(*) as count FROM "${table}";`, [], (err, row) => {
                if (err) {
                    console.log(`Error counting records in ${table}:`, err.message);
                } else {
                    console.log(`Tabla: ${table.padEnd(30)} | Registros: ${row.count}`);
                }
            });
        });
    });
});
