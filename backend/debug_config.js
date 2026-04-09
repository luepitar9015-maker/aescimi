const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- SYSTEM SETTINGS ---');
db.all("SELECT * FROM system_settings", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));

    console.log('\n--- TRD SERIES (Sample) ---');
    db.all("SELECT * FROM trd_series LIMIT 2", [], (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));

        console.log('\n--- TRD SUBSERIES (Sample) ---');
        db.all("SELECT * FROM trd_subseries LIMIT 2", [], (err, rows) => {
            if (err) console.error(err);
            else console.log(JSON.stringify(rows, null, 2));

            console.log('\n--- ORGANIZATION STRUCTURE (Sample) ---');
            db.all("SELECT * FROM organization_structure LIMIT 2", [], (err, rows) => {
                if (err) console.error(err);
                else console.log(JSON.stringify(rows, null, 2));
                db.close();
            });
        });
    });
});
