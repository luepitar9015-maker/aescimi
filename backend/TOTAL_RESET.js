const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
};

async function totalReset() {
    console.log("--- INICIANDO REINICIO TOTAL DEL SISTEMA ---");

    // 1. Conectar a postgres para limpiar la base de datos
    const adminClient = new Client({ ...pgConfig, database: 'postgres' });
    try {
        await adminClient.connect();
        console.log("Conectado a PostgreSQL (admin).");
        
        // Terminar otras conexiones para poder borrar
        await adminClient.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sena_db' AND pid <> pg_backend_pid()");
        
        console.log("Eliminando base de datos antigua 'sena_db'...");
        await adminClient.query("DROP DATABASE IF EXISTS sena_db");
        
        console.log("Creando base de datos limpia 'sena_db'...");
        await adminClient.query("CREATE DATABASE sena_db");
    } catch (err) {
        console.error("Error en reset de DB:", err.message);
        process.exit(1);
    } finally {
        await adminClient.end();
    }

    // 2. Conectar a la nueva base de datos
    const db = new Client({ ...pgConfig, database: 'sena_db' });
    await db.connect();
    console.log("Conectado a 'sena_db' limpia.");

    // 3. Crear Esquemas
    const schemas = [
        `CREATE TABLE users (
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
        `CREATE TABLE organization_structure (
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
            storage_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE trd_series (
            id SERIAL PRIMARY KEY,
            dependency_id INTEGER,
            series_code TEXT,
            series_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE trd_subseries (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_code TEXT,
            subseries_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE trd_typologies (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_id INTEGER,
            typology_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE documents (
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
        `CREATE TABLE expedientes (
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
        `CREATE TABLE system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE role_permissions (
            id SERIAL PRIMARY KEY,
            role_name TEXT NOT NULL,
            module_id TEXT NOT NULL,
            can_view INTEGER DEFAULT 1,
            UNIQUE(role_name, module_id)
        )`,
        `CREATE TABLE user_trd_permissions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            series_id INTEGER,
            subseries_id INTEGER,
            can_view INTEGER DEFAULT 1,
            can_edit INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    console.log("Creando tablas...");
    for (const sql of schemas) {
        await db.query(sql);
    }

    // 4. Migrar desde SQLite
    const sqlitePath = path.resolve(__dirname, 'database.sqlite');
    if (fs.existsSync(sqlitePath)) {
        console.log("Migrando datos desde SQLite...");
        const sqliteDb = new sqlite3.Database(sqlitePath);
        
        const tables = [
            'users', 'organization_structure', 'trd_series', 'trd_subseries', 
            'trd_typologies', 'documents', 'expedientes', 'system_settings', 'role_permissions'
        ];

        for (const table of tables) {
            await new Promise((resolve) => {
                sqliteDb.all(`SELECT * FROM ${table}`, async (err, rows) => {
                    if (err || !rows || rows.length === 0) return resolve();
                    
                    console.log(`- Migrando ${table}: ${rows.length} filas`);
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

                    for (const row of rows) {
                        const values = columns.map(col => row[col]);
                        try { await db.query(insertSql, values); } catch (e) {}
                    }
                    resolve();
                });
            });
        }
        sqliteDb.close();
    } else {
        console.log("No se encontró database.sqlite, iniciando con tablas vacías.");
    }

    // 5. Activar Sistema y Asegurar Superusuario
    console.log("Configurando activacion y superusuario...");
    await db.query("INSERT INTO system_settings (key, value) VALUES ('system_expiration_date', '2030-12-31') ON CONFLICT (key) DO UPDATE SET value = '2030-12-31'");
    
    // Asegurar que exista un admin si no hay usuarios
    const userCheck = await db.query("SELECT count(*) FROM users");
    if (parseInt(userCheck.rows[0].count) === 0) {
        await db.query(`INSERT INTO users (full_name, document_no, password_hash, role) 
                        VALUES ('Administrador Sistema', 'admin', '$2b$10$765432109876543210987u.X4r4u/UXS5y.377O/A4.A4A4A4A4A4', 'superadmin')`);
        console.log("Superusuario 'admin' creado (Pass: admin123 o similar).");
    }

    // 6. Corregir Secuencias (Serial IDs)
    const sequences = [
        'users', 'organization_structure', 'trd_series', 'trd_subseries', 
        'trd_typologies', 'documents', 'expedientes', 'system_settings', 'role_permissions'
    ];
    for (const table of sequences) {
        try {
            await db.query(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
        } catch (e) {}
    }

    console.log("\n--- REINICIO COMPLETADO EXITOSAMENTE ---");
    console.log("Ahora puedes iniciar los servidores.");
    
    await db.end();
}

totalReset();
