const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Inspecting data.db ---');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) return console.error(err);
        console.log('Tables found in data.db:', tables.map(t => t.name));
        
        tables.forEach(table => {
            db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
                if (err) return;
                console.log(`Table ${table.name} columns: ${columns.map(c => c.name)}`);
            });
        });
    });
});
