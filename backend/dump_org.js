const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.all('SELECT * FROM organization_structure', [], (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    fs.writeFileSync('org_dump.json', JSON.stringify(rows, null, 2), 'utf8');
    console.log('Fichero org_dump.json generado.');
    db.close();
});
