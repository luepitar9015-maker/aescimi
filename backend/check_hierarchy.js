const db = require('./database');

db.all("SELECT id, subseries_code, subseries_name, folder_hierarchy, metadata_labels FROM trd_subseries", [], (err, rows) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('=== TRD SUBSERIES ===');
    rows.forEach(r => {
        console.log(`ID:${r.id} | ${r.subseries_code} | ${r.subseries_name}`);
        console.log(`  folder_hierarchy: ${r.folder_hierarchy || '(null)'}`);
        console.log(`  metadata_labels: ${r.metadata_labels || '(null)'}`);
    });
    if (rows.length === 0) console.log('(no subseries found)');
    
    db.all("SELECT key, substr(value, 1, 100) as val FROM system_settings", [], (err2, rows2) => {
        if (!err2) {
            console.log('\n=== SYSTEM SETTINGS ===');
            rows2.forEach(r => console.log(`[${r.key}] = ${r.val}`));
        }
        process.exit(0);
    });
});
