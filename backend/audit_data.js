const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

const run = async () => {
    try {
        const orgs = await new Promise((res, rej) => db.all('SELECT * FROM organization_structure', (err, rows) => err ? rej(err) : res(rows)));
        const series = await new Promise((res, rej) => db.all('SELECT id, series_code, series_name, dependency_id FROM trd_series', (err, rows) => err ? rej(err) : res(rows)));
        
        fs.writeFileSync('org_audit.json', JSON.stringify(orgs, null, 2));
        fs.writeFileSync('series_audit.json', JSON.stringify(series, null, 2));
        
        console.log('Auditoria generada exitosamente.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        db.close();
    }
};

run();
