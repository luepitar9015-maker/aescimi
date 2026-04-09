const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Searching for Metadata Keywords ---');
const keywords = ['Nombre', 'Identificacion', 'Fecha', 'Documento'];

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        tables.forEach(table => {
            db.all(`SELECT * FROM ${table.name} LIMIT 100`, (err, rows) => {
                if (err) return;
                const rowsStr = JSON.stringify(rows);
                keywords.forEach(kw => {
                    if (rowsStr.includes(kw)) {
                        console.log(`Table ${table.name} contains keyword: ${kw}`);
                    }
                });
            });
        });
    });
});
