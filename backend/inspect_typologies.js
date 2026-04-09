const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- TABLES ---');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows));

    console.log('\n--- TYPOLOGIES SCHEMA ---');
    db.all("PRAGMA table_info(typologies)", [], (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows));

        console.log('\n--- SEARCHING FOR PETICION IN TYPOLOGIES ---');
        db.all("SELECT * FROM typologies WHERE name LIKE '%peticion%'", [], (err, rows) => {
            if (err) console.error(err);
            else console.log(JSON.stringify(rows));
            db.close();
        });
    });
});
