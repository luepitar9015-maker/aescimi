const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pgPool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'sena_db',
    password: 'admin123',
    port: 5000,
});

async function migrate() {
    let sqliteFile = path.join(__dirname, 'database.sqlite');
    if (!fs.existsSync(sqliteFile) && fs.existsSync(path.join(__dirname, 'data.db'))) {
        sqliteFile = path.join(__dirname, 'data.db');
    } else if (!fs.existsSync(sqliteFile) && !fs.existsSync(path.join(__dirname, 'data.db'))) {
        console.error("No SQLite database found.");
        process.exit(1);
    }

    console.log(`Using SQLite database: ${sqliteFile}`);
    const sqliteDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY);

    const getSqlite = (query, params = []) => new Promise((resolve, reject) => {
        sqliteDb.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    try {
        console.log("Reading data from SQLite...");
        const deps = await getSqlite("SELECT * FROM organization_structure");
        const series = await getSqlite("SELECT * FROM trd_series");
        const subseries = await getSqlite("SELECT * FROM trd_subseries");
        const typologies = await getSqlite("SELECT * FROM trd_typologies");

        console.log(`Found: ${deps.length} Dependencies, ${series.length} Series, ${subseries.length} Subseries, ${typologies.length} Typologies`);

        // Helper to upsert
        async function upsert(table, row, idField = 'id') {
            const keys = Object.keys(row);
            const values = Object.values(row);
            const idVal = row[idField];
            
            const check = await pgPool.query(`SELECT 1 FROM ${table} WHERE ${idField} = $1`, [idVal]);
            if (check.rowCount > 0) {
                const updates = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
                await pgPool.query(`UPDATE ${table} SET ${updates} WHERE ${idField} = $${keys.length + 1}`, [...values, idVal]);
            } else {
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                await pgPool.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
            }
        }

        console.log("Migrating to PostgreSQL...");
        // 1. Dependencies
        for (const d of deps) await upsert('organization_structure', d);
        console.log(`Migrated ${deps.length} dependencies.`);

        // 2. Series
        for (const s of series) await upsert('trd_series', s);
        console.log(`Migrated ${series.length} series.`);

        // 3. Subseries
        for (const s of subseries) await upsert('trd_subseries', s);
        console.log(`Migrated ${subseries.length} subseries.`);

        // 4. Typologies
        for (const t of typologies) await upsert('trd_typologies', t);
        console.log(`Migrated ${typologies.length} typologies.`);

        // Sequences
        const setSeq = async (seq, table) => {
            try { 
                await pgPool.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`); 
            } catch(e) {
                // If sequence doesn't exist, ignore
            }
        };
        await setSeq('organization_structure_id_seq', 'organization_structure');
        await setSeq('trd_series_id_seq', 'trd_series');
        await setSeq('trd_subseries_id_seq', 'trd_subseries');
        await setSeq('trd_typologies_id_seq', 'trd_typologies');

        console.log("Migration completed successfully!");

    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        sqliteDb.close();
        pgPool.end();
    }
}

migrate();
