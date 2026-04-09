const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- EXPEDIENTES METADATA ---');
db.all("SELECT metadata_values FROM expedientes WHERE metadata_values IS NOT NULL LIMIT 10", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});
