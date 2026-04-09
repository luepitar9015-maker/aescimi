/**
 * Script para verificar si la columna storage_path existe en la tabla documents
 * y crearla si no existe.
 * Ejecutar con: node check_storage_path_col.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function run() {
    const client = await pool.connect();
    try {
        // 1. Verificar columnas actuales de la tabla documents
        const { rows: cols } = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'documents' 
            ORDER BY ordinal_position;
        `);
        console.log('\n=== Columnas de la tabla "documents" ===');
        cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
        
        const hasStoragePath = cols.some(c => c.column_name === 'storage_path');
        
        if (hasStoragePath) {
            console.log('\n✅ La columna storage_path YA EXISTE en documents.');
            
            // Mostrar algunos ejemplos de valores
            const { rows: sample } = await client.query(`
                SELECT id, filename, storage_path 
                FROM documents 
                WHERE storage_path IS NOT NULL AND storage_path != ''
                LIMIT 5;
            `);
            if (sample.length > 0) {
                console.log('\n--- Ejemplos con storage_path ---');
                sample.forEach(r => console.log(`  ID ${r.id}: ${r.filename} -> ${r.storage_path}`));
            } else {
                console.log('\n⚠️ La columna existe pero NO tiene valores. Los documentos no tienen storage_path asignado.');
            }
        } else {
            console.log('\n❌ La columna storage_path NO existe en documents. Creándola...');
            await client.query(`
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
            `);
            console.log('✅ Columna storage_path creada exitosamente.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
