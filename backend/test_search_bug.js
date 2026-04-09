const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function testSearch() {
    const term = '720250004110';
    const query = `
        SELECT e.*, MAX(sub.metadata_labels) as sub_labels, MAX(s.metadata_labels) as series_labels
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series s ON (e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
        WHERE e.expediente_code LIKE $1 
           OR e.title LIKE $1 
           OR e.subserie LIKE $1 
           OR e.box_id LIKE $1
           OR e.metadata_values LIKE $1
        GROUP BY e.id
        ORDER BY e.created_at DESC
    `;
    const searchPattern = `%${term}%`;
    
    try {
        const res = await pool.query(query, [searchPattern]);
        console.log("Results count:", res.rows.length);
    } catch (err) {
        console.error("SQL Error Code:", err.code);
        console.error("SQL Error Message:", err.message);
    } finally {
        await pool.end();
    }
}

testSearch();
