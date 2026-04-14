// Limpia registros de documents en BD usando el módulo pg del backend
// Resuelve node_modules desde la carpeta del backend
const path = require('path');
const fs   = require('fs');

// Apuntar manualmente a node_modules del backend
const nmPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nmPath)) {
    console.error('ERROR: No se encontró node_modules en ' + nmPath);
    console.error('Ejecuta primero: npm install');
    process.exit(1);
}

// Leer .env manualmente
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

// Cargar pg desde node_modules local
const { Pool } = require(path.join(nmPath, 'pg'));

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'sena_db',
    password: process.env.DB_PASSWORD || 'admin2026',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
});

async function limpiarBD() {
    console.log('\n══════════════════════════════════════════════');
    console.log('     LIMPIEZA DE REGISTROS EN BASE DE DATOS   ');
    console.log('══════════════════════════════════════════════\n');

    // Contar antes
    const antes = await pool.query('SELECT COUNT(*) as total FROM documents');
    console.log('  Documentos antes: ' + antes.rows[0].total);

    // Eliminar
    const result = await pool.query('DELETE FROM documents');
    console.log('  Documentos eliminados: ' + result.rowCount);

    // Verificar
    const despues = await pool.query('SELECT COUNT(*) as total FROM documents');
    console.log('  Documentos después: ' + despues.rows[0].total);

    console.log('\n══════════════════════════════════════════════');
    console.log('  Base de datos limpia ✓');
    console.log('══════════════════════════════════════════════\n');

    await pool.end();
}

limpiarBD().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
