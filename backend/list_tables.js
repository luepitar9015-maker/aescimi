const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Tables:', rows.map(r => r.name).join(', '));
        
        // Let's also check trd_subseries structure
        db.all("PRAGMA table_info(trd_subseries)", [], (err, info) => {
            if (!err) console.log('trd_subseries schema:', JSON.stringify(info));
            
            // And metadata_templates
            db.all("PRAGMA table_info(metadata_templates)", [], (err, info) => {
                if (!err) console.log('metadata_templates schema:', JSON.stringify(info));
                db.close();
            });
        });
    }
});
