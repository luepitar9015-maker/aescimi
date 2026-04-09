const db = require('./database');

db.all("SELECT key, value FROM system_settings", [], (err, rows) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('=== SYSTEM SETTINGS ===');
    rows.forEach(r => console.log(`[${r.key}] = ${r.value}`));
    if (rows.length === 0) console.log('(no settings found)');
    process.exit(0);
});
