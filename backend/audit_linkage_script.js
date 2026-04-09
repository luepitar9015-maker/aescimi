const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

const audit = { organizations: [], series: [] };

db.all('SELECT * FROM organization_structure', [], (err, orgs) => {
    audit.organizations = orgs || [];
    db.all('SELECT id, series_code, series_name, dependency_id FROM trd_series', [], (err, series) => {
        audit.series = series || [];
        fs.writeFileSync('audit_linkage.json', JSON.stringify(audit, null, 2), 'utf8');
        console.log('Audit generated: audit_linkage.json');
        db.close();
    });
});
