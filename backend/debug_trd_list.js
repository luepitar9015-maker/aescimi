const db = require('./database');

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
        d.subsection_name
    FROM trd_subseries sub
    JOIN trd_series s ON sub.series_id = s.id
    LEFT JOIN organization_structure d ON s.dependency_id = d.id
    
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
        d.subsection_name
    FROM trd_series s
    LEFT JOIN organization_structure d ON s.dependency_id = d.id
    
    ORDER BY subseries_code ASC
`;

console.log('--- EXECUTING TRD DEBUG QUERY ---');
db.all(query, [], (err, rows) => {
    if (err) {
        console.error('SQL ERROR:', err);
        process.exit(1);
    }
    
    console.log(`Total Records Found: ${rows.length}`);
    
    const historia = rows.find(r => r.subseries_name && r.subseries_name.includes('HISTORIA'));
    if (historia) {
        console.log('Target record found:', JSON.stringify(historia, null, 2));
    } else {
        console.log('TARGET RECORD NOT FOUND (HISTORIA)');
    }
    
    console.log('Sample of first 5 records:');
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    
    process.exit(0);
});
