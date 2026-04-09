const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const tables = ['users', 'expedientes', 'documents', 'system_settings', 'trd_sections', 'trd_subsections', 'trd_series', 'trd_subseries', 'trd_typologies', 'metadata_templates', 'metadata_values'];

const search = (tableIndex) => {
    if (tableIndex >= tables.length) {
        db.close();
        return;
    }

    const table = tables[tableIndex];
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (!err) {
            rows.forEach(row => {
                const rowStr = JSON.stringify(row).toLowerCase();
                if (rowStr.includes('peticion') || rowStr.includes(':4') || rowStr.includes(' "4"') || rowStr.includes(' 4')) {
                    console.log(`Match in ${table}:`, JSON.stringify(row));
                }
            });
        }
        search(tableIndex + 1);
    });
};

search(0);
