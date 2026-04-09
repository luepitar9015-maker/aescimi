const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT key, value FROM system_settings WHERE key = 'storage_path'", [], (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('=== storage_path en BD ===');
        console.log(JSON.stringify(rows, null, 2));
    }
});

db.all("SELECT id, filename, path FROM documents ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
    if (err) {
        console.error('Error docs:', err.message);
    } else {
        console.log('\n=== Últimos 10 documentos ===');
        rows.forEach(r => console.log(`  [${r.id}] ${r.filename}\n      -> ${r.path}`));
    }
    db.close();
});
