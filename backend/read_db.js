const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- SYSTEM SETTINGS ---');
db.all("SELECT * FROM system_settings", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});

console.log('--- TRD SERIES (SAMPLE) ---');
db.all("SELECT id, series_name, metadata_labels FROM trd_series LIMIT 5", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});
