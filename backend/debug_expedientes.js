const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const query = `
    SELECT 
        e.id, e.expediente_code, e.title, e.subserie,
        s.subseries_code, s.subseries_name,
        ser.series_code, ser.series_name,
        org.section_code, org.subsection_code
    FROM expedientes e
    LEFT JOIN trd_subseries s ON (e.subserie = s.subseries_code OR e.subserie = s.subseries_name)
    LEFT JOIN trd_series ser ON s.series_id = ser.id
    LEFT JOIN organization_structure org ON ser.dependency_id = org.id
    LIMIT 5
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('=== Mapeo de Expedientes a Códigos TRD ===');
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
