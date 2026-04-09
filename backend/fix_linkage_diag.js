const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.all('SELECT * FROM organization_structure WHERE regional_code = "68" AND section_code = "4"', [], (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('DEPENDENCIES FOUND:', JSON.stringify(rows, null, 2));
    
    db.all('SELECT * FROM trd_series WHERE series_code = "37"', [], (err, series) => {
        console.log('SERIES FOUND:', JSON.stringify(series, null, 2));
        db.close();
    });
});
