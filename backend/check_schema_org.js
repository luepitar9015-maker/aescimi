const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("PRAGMA table_info(organization_structure)", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(rows);
});
