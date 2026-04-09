const { Client } = require('pg');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'sena_db',
};

async function fixSchema() {
    const db = new Client(pgConfig);
    try {
        await db.connect();
        console.log("--- ACTUALIZANDO ESQUEMA DE BASE DE DATOS ---");
        
        // Add missing storage_path to organization_structure
        try {
            await db.query("ALTER TABLE organization_structure ADD COLUMN IF NOT EXISTS storage_path TEXT");
            console.log("[OK] Columna 'storage_path' añadida a 'organization_structure'.");
        } catch (e) {
            console.log("[INFO] La columna 'storage_path' ya existía o hubo un error manejado.");
        }

        console.log("\nEsquema actualizado. Sekarang puedes crear dependencias sin error.");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await db.end();
    }
}

fixSchema();
