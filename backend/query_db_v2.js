const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- System Settings ---');
db.all("SELECT * FROM system_settings", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));

    console.log('\n--- TRD Series (searching for Peticion) ---');
    db.all("SELECT * FROM trd_series WHERE series_name LIKE '%peticion%'", [], (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));

        console.log('\n--- TRD Subseries (searching for Peticion) ---');
        db.all("SELECT * FROM trd_subseries WHERE subseries_name LIKE '%peticion%'", [], (err, rows) => {
            if (err) console.error(err);
            else console.log(JSON.stringify(rows, null, 2));
            db.close();
        });
    });
});
