const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Try both passwords
const PASSWORDS = ['admin123', 'admin2026', 'postgres', ''];

async function tryConnect(password) {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: password,
        port: 5432,
        connectionTimeoutMillis: 3000,
    });
    try {
        await client.connect();
        console.log(`✅ Conectado con contraseña: "${password}"`);
        return { client, password };
    } catch (e) {
        console.log(`❌ Falló con contraseña: "${password}" -> ${e.message}`);
        return null;
    }
}

async function setup() {
    let result = null;
    
    for (const pwd of PASSWORDS) {
        result = await tryConnect(pwd);
        if (result) break;
    }
    
    if (!result) {
        console.error('\n🔴 No se pudo conectar a PostgreSQL con ninguna contraseña.');
        console.error('Por favor verifique que PostgreSQL esté corriendo y la contraseña sea correcta.');
        process.exit(1);
    }
    
    const { client: pgClient, password: workingPassword } = result;
    
    // Update database_pg.js with the working password
    const fs = require('fs');
    const path = require('path');
    const dbPgPath = path.join(__dirname, 'database_pg.js');
    let dbPgContent = fs.readFileSync(dbPgPath, 'utf8');
    dbPgContent = dbPgContent.replace(/password: '[^']*'/, `password: '${workingPassword}'`);
    fs.writeFileSync(dbPgPath, dbPgContent);
    console.log(`\n✅ database_pg.js actualizado con contraseña: "${workingPassword}"`);
    
    // Create sena_db if not exists
    try {
        const res = await pgClient.query("SELECT 1 FROM pg_database WHERE datname='sena_db'");
        if (res.rowCount === 0) {
            await pgClient.query('CREATE DATABASE sena_db');
            console.log("✅ Base de datos 'sena_db' creada.");
        } else {
            console.log("✅ Base de datos 'sena_db' ya existe.");
        }
    } catch (e) {
        console.error('Error creando base de datos:', e.message);
    }
    await pgClient.end();
    
    // Connect to sena_db and create tables
    const db = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'sena_db',
        password: workingPassword,
        port: 5432,
    });
    await db.connect();
    console.log("\n📋 Creando tablas...");
    
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            area TEXT,
            position TEXT,
            document_no TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            organization_id INTEGER,
            is_active INTEGER DEFAULT 1,
            license_type TEXT,
            license_expiry TEXT,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            must_change_password INTEGER DEFAULT 1
        )`,
        `CREATE TABLE IF NOT EXISTS organization_structure (
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
        `CREATE TABLE IF NOT EXISTS trd_series (
            id SERIAL PRIMARY KEY,
            dependency_id INTEGER,
            series_code TEXT,
            series_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            storage_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS trd_subseries (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_code TEXT,
            subseries_name TEXT,
            folder_hierarchy TEXT,
            metadata_labels TEXT,
            storage_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS trd_typologies (
            id SERIAL PRIMARY KEY,
            series_id INTEGER,
            subseries_id INTEGER,
            typology_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS documents (
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
        `CREATE TABLE IF NOT EXISTS expedientes (
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
            origen TEXT,
            storage_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY,
            role_name TEXT NOT NULL,
            module_id TEXT NOT NULL,
            can_view INTEGER DEFAULT 1,
            UNIQUE(role_name, module_id)
        )`,
    ];
    
    for (const sql of tables) {
        try {
            await db.query(sql);
            const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
            console.log(`  ✅ Tabla '${tableName}' lista.`);
        } catch (e) {
            console.error(`  ❌ Error:`, e.message);
        }
    }
    
    // Insert default system settings
    try {
        await db.query(`INSERT INTO system_settings (key, value) VALUES ('system_expiration_date', '2030-12-31') ON CONFLICT (key) DO NOTHING`);
        console.log("  ✅ Configuración del sistema insertada.");
    } catch(e) {}
    
    // Seed superuser
    console.log("\n👤 Creando superusuario...");
    const fullName = 'Luis Ernesto Parada Moreno';
    const documentNo = '1098680638';
    const position = 'Gestión Documental';
    const password = 'Santander2026**';
    const area = 'Administración';
    const email = 'luis.parada@sena.edu.co';
    const role = 'superadmin';
    
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    
    try {
        await db.query(
            `INSERT INTO users (full_name, document_no, position, password_hash, area, email, role) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (document_no) DO UPDATE 
             SET full_name = EXCLUDED.full_name, 
                 position = EXCLUDED.position, 
                 password_hash = EXCLUDED.password_hash, 
                 role = EXCLUDED.role`,
            [fullName, documentNo, position, hash, area, email, role]
        );
        console.log(`  ✅ Superusuario creado: ${documentNo} / Santander2026**`);
    } catch (e) {
        console.error('  ❌ Error creando superusuario:', e.message);
    }
    
    // Seed superadmin permissions
    const modules = [
        'dashboard', 'trd', 'expedientes', 'documents', 'query',
        'mass-upload', 'cargue-aes', 'letters', 'onedrive',
        'config-aes', 'automation', 'users', 'permissions', 'trd_query', 'superuser_module'
    ];
    for (const mod of modules) {
        try {
            await db.query(
                `INSERT INTO role_permissions (role_name, module_id, can_view) VALUES ($1, $2, $3) ON CONFLICT (role_name, module_id) DO UPDATE SET can_view = 1`,
                ['superadmin', mod, 1]
            );
        } catch (e) {}
    }
    console.log("  ✅ Permisos de superadmin configurados.");
    
    await db.end();
    
    console.log("\n🎉 ¡Setup completado exitosamente!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("   Usuario:    1098680638");
    console.log("   Contraseña: Santander2026**");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n▶ Ahora reinicie el backend con: node server.js");
}

setup().catch(e => {
    console.error('Error fatal:', e.message);
    process.exit(1);
});
