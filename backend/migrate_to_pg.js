const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

const sqliteDbPath = path.resolve(__dirname, 'database.sqlite');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

const pgConfig = {
    user: 'postgres',
    host: 'localhost',
    password: 'admin123',
    port: 5432,
};

async function migrate() {
    const pgClient = new Client({ ...pgConfig, database: 'postgres' });
    await pgClient.connect();

    try {
        console.log("Checking/Creating database 'sena_db'...");
        const res = await pgClient.query("SELECT 1 FROM pg_database WHERE datname='sena_db'");
        if (res.rowCount === 0) {
            await pgClient.query("CREATE DATABASE sena_db");
            console.log("Database 'sena_db' created.");
        }
    } catch (e) {
        console.error("Error creating database:", e.message);
    } finally {
        await pgClient.end();
    }

    const db = new Client({ ...pgConfig, database: 'sena_db' });
    await db.connect();

    console.log("Connected to PostgreSQL. Starting migration...");

    const tables = [
        'users', 'organization_structure', 'trd_series', 'trd_subseries',
        'trd_typologies', 'documents', 'expedientes', 'system_settings', 'role_permissions'
    ];

    // Basic schema mapping (SQLite to PG)
    const schemaMapping = {
        'users': `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            area TEXT,
            position TEXT,
            document_no TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            organization_id INTEGER
        )`,
        'organization_structure': `CREATE TABLE IF NOT EXISTS organization_structure (
            id SERIAL PRIMARY KEY,
            entity_name TEXT DEFAULT 'SENA',
            regional_code TEXT,
            regional_name TEXT,
            center_code TEXT,
            center_name TEXT,
            section_code TEXT,
            section_name TEXT,
            subsection_code TEXT,
            subsection_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'trd_series': `CREATE TABLE IF NOT EXISTS trd_series (
            id SERIAL PRIMARY KEY,
            dependency_id INTEGER,
            series_code TEXT,
            series_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'trd_subseries': `CREATE TABLE IF NOT EXISTS trd_subseries (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_code TEXT,
            subseries_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'trd_typologies': `CREATE TABLE IF NOT EXISTS trd_typologies (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_id INTEGER,
            typology_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'documents': `CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            organization_id INTEGER,
            trd_series_id INTEGER,
            trd_subseries_id INTEGER,
            expediente_id INTEGER,
            filename TEXT,
            path TEXT,
            typology_name TEXT,
            document_date TIMESTAMP,
            status TEXT DEFAULT 'Pendiente',
            ades_id TEXT,
            load_date TIMESTAMP,
            metadata_values TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'expedientes': `CREATE TABLE IF NOT EXISTS expedientes (
            id SERIAL PRIMARY KEY,
            expediente_code TEXT,
            box_id TEXT,
            opening_date TIMESTAMP,
            subserie TEXT,
            regional TEXT,
            centro TEXT,
            dependencia TEXT,
            storage_type TEXT,
            title TEXT,
            metadata_values TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'system_settings': `CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        'role_permissions': `CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY,
            role_name TEXT NOT NULL,
            module_id TEXT NOT NULL,
            can_view INTEGER DEFAULT 1,
            UNIQUE(role_name, module_id)
        )`
    };

    for (const table of tables) {
        console.log(`Migrating table: ${table}...`);
        await db.query(schemaMapping[table]);

        sqliteDb.all(`SELECT * FROM ${table}`, async (err, rows) => {
            if (err) {
                console.error(`Error reading ${table}:`, err.message);
                return;
            }
            if (rows.length === 0) return;

            const columns = Object.keys(rows[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

            for (const row of rows) {
                const values = columns.map(col => row[col]);
                try {
                    await db.query(insertSql, values);
                } catch (e) {
                    // console.error(`Error inserting into ${table}:`, e.message);
                }
            }
            console.log(`Finished migrating ${table} (${rows.length} rows attempted).`);
        });
    }

    // Wait a bit for async operations to complete
    setTimeout(() => {
        console.log("Migration script finished processing.");
        db.end();
        sqliteDb.close();
    }, 10000);
}

migrate();
