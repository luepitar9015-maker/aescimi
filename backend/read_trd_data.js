const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- TRD SERIES ---');
db.all("SELECT id, series_code, series_name, metadata_labels FROM trd_series", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});

console.log('--- TRD SUBSERIES ---');
db.all("SELECT id, subseries_code, subseries_name, metadata_labels FROM trd_subseries", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});
