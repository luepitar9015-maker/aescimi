const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

const query = `
    SELECT 
        'subseries' as type,
        sub.id, 
        sub.subseries_code, 
        sub.subseries_name, 
        sub.metadata_labels, 
        s.series_code, 
        s.series_name, 
        s.metadata_labels as series_labels, 
        d.section_name, 
        d.subsection_name,
        d.regional_code,
        d.center_code,
        d.section_code,
        d.subsection_code
    FROM trd_subseries sub
    JOIN trd_series s ON sub.series_id = s.id
    LEFT JOIN organization_structure d ON s.dependency_id = d.id
    WHERE sub.subseries_code = '37' OR sub.subseries_name LIKE '%ACADEMICA%' OR s.series_code = '37'

    UNION ALL
    
    SELECT 
        'series' as type,
        s.id, 
        s.series_code as subseries_code, 
        s.series_name as subseries_name, 
        s.metadata_labels, 
        s.series_code, 
        s.series_name, 
        s.metadata_labels as series_labels, 
        d.section_name, 
        d.subsection_name,
        d.regional_code,
        d.center_code,
        d.section_code,
        d.subsection_code
    FROM trd_series s
    LEFT JOIN organization_structure d ON s.dependency_id = d.id
    WHERE s.series_code = '37' OR s.series_name LIKE '%ACADEMICA%'
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    
    const processed = rows.map(r => {
        const reg = r.regional_code || '';
        const ctr = r.center_code || '';
        const sec = r.section_code || '';
        const sub = r.subsection_code ? '.' + r.subsection_code : '';
        const trd_code = r.type === 'subseries' ? r.subseries_code : r.series_code;
        
        const concat = reg + (reg && ctr ? '.' : '') + ctr + (ctr && sec ? '.' : '') + sec + sub + '-' + trd_code;
        
        return {
            type: r.type,
            id: r.id,
            subseries_code: r.subseries_code,
            concatenated_code: concat,
            name: r.subseries_name
        };
    });
    
    const fs = require('fs');
    fs.writeFileSync('trd_dump_v2.json', JSON.stringify(processed, null, 2), 'utf8');
    console.log('Fichero trd_dump_v2.json generado.');
    db.close();
});
