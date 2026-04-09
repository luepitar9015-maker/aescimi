const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- ALL SERIES ---');
db.all("SELECT id, series_code, series_name FROM trd_series", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows));

    console.log('\n--- ALL SUBSERIES ---');
    db.all("SELECT id, subseries_code, subseries_name FROM trd_subseries", [], (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows));
        db.close();
    });
});
