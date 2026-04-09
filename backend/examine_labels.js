const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, subseries_code, subseries_name, metadata_labels FROM trd_subseries", (err, rows) => {
    if (err) console.error(err);
    rows.forEach(r => {
        if (r.metadata_labels) console.log(`ID ${r.id} (${r.subseries_name}) HAS labels: ${r.metadata_labels}`);
        else console.log(`ID ${r.id} (${r.subseries_name}) NO labels`);
    });
});
