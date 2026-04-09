const db = require('./database_pg');

const queries = [
    `UPDATE trd_typologies SET typology_name = REPLACE(typology_name, 'Á', 'A')`,
    `UPDATE trd_typologies SET typology_name = REPLACE(typology_name, 'É', 'E')`,
    `UPDATE trd_typologies SET typology_name = REPLACE(typology_name, 'Í', 'I')`,
    `UPDATE trd_typologies SET typology_name = REPLACE(typology_name, 'Ó', 'O')`,
    `UPDATE trd_typologies SET typology_name = REPLACE(typology_name, 'Ú', 'U')`
];

async function run() {
    try {
        let total = 0;
        for (const q of queries) {
            const res = await db.pool.query(q);
            total += res.rowCount;
        }
        console.log(`OK: Tildes eliminadas. ${total} filas actualizadas en total.`);
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

run();
