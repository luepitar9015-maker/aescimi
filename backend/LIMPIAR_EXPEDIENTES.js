/**
 * LIMPIAR_EXPEDIENTES.js
 * ──────────────────────────────────────────────────────────────
 * Elimina TODOS los expedientes y documentos del sistema SENA:
 *   1. Registros en la BD PostgreSQL (expedientes + documents)
 *   2. Archivos físicos en la carpeta uploads/Gestion_Documental/
 *   3. Archivos sueltos en uploads/temp/
 * ──────────────────────────────────────────────────────────────
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Leer .env ─────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

// ── Cargar pg ─────────────────────────────────────────────────
const nmPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nmPath)) {
    console.error('ERROR: No se encontró node_modules. Ejecuta: npm install');
    process.exit(1);
}
const { Pool } = require(path.join(nmPath, 'pg'));

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'sena_db',
    password: process.env.DB_PASSWORD || 'admin2026',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
});

// ── Utilidades de archivos ────────────────────────────────────
function eliminarCarpetaRecursiva(carpeta) {
    if (!fs.existsSync(carpeta)) return 0;
    let totalArchivos = 0;
    const items = fs.readdirSync(carpeta);
    for (const item of items) {
        const fullPath = path.join(carpeta, item);
        if (fs.statSync(fullPath).isDirectory()) {
            totalArchivos += eliminarCarpetaRecursiva(fullPath);
        } else {
            fs.unlinkSync(fullPath);
            totalArchivos++;
            console.log('  [ARCHIVO]  ' + fullPath);
        }
    }
    fs.rmdirSync(carpeta);
    console.log('  [CARPETA]  ' + carpeta);
    return totalArchivos;
}

function vaciarCarpeta(carpeta) {
    if (!fs.existsSync(carpeta)) return 0;
    let total = 0;
    const items = fs.readdirSync(carpeta);
    for (const item of items) {
        const fullPath = path.join(carpeta, item);
        if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
            total++;
            console.log('  [ARCHIVO]  ' + fullPath);
        }
    }
    return total;
}

// ── Función principal ─────────────────────────────────────────
async function limpiarTodo() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║      LIMPIEZA TOTAL DE EXPEDIENTES - SENA V2         ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    // ── PASO 1: Base de datos ─────────────────────────────────
    console.log('▶ PASO 1: Limpiando base de datos PostgreSQL...');
    console.log('');

    try {
        // Contar registros actuales
        const cntDocs  = await pool.query('SELECT COUNT(*) AS total FROM documents');
        const cntExp   = await pool.query('SELECT COUNT(*) AS total FROM expedientes');
        console.log(`  Expedientes en BD:  ${cntExp.rows[0].total}`);
        console.log(`  Documentos en BD:   ${cntDocs.rows[0].total}`);
        console.log('');

        // Eliminar en orden (documentos primero por FK)
        const resDocs = await pool.query('DELETE FROM documents');
        console.log(`  ✓ Documentos eliminados: ${resDocs.rowCount}`);

        const resExp  = await pool.query('DELETE FROM expedientes');
        console.log(`  ✓ Expedientes eliminados: ${resExp.rowCount}`);

        // Reiniciar secuencias para que los IDs vuelvan a empezar desde 1
        await pool.query("SELECT setval('documents_id_seq',  1, false)");
        await pool.query("SELECT setval('expedientes_id_seq', 1, false)");
        console.log('  ✓ Secuencias de IDs reiniciadas a 1');

        // Verificar que quedó vacío
        const verDocs = await pool.query('SELECT COUNT(*) AS total FROM documents');
        const verExp  = await pool.query('SELECT COUNT(*) AS total FROM expedientes');
        console.log('');
        console.log(`  Documentos restantes:  ${verDocs.rows[0].total}`);
        console.log(`  Expedientes restantes: ${verExp.rows[0].total}`);

    } catch (err) {
        console.error('  ✗ Error en base de datos:', err.message);
        console.error('    Verifica que PostgreSQL esté activo y las credenciales en .env sean correctas.');
        await pool.end();
        process.exit(1);
    }

    await pool.end();

    // ── PASO 2: Archivos físicos ──────────────────────────────
    console.log('');
    console.log('▶ PASO 2: Limpiando archivos físicos...');
    console.log('');

    const uploadsDir = path.join(__dirname, 'uploads');
    let totalArchivosEliminados = 0;

    // 2a. Carpeta Gestion_Documental (expedientes físicos)
    const gdPath = path.join(uploadsDir, 'Gestion_Documental');
    if (fs.existsSync(gdPath)) {
        console.log('  Eliminando uploads/Gestion_Documental/...');
        totalArchivosEliminados += eliminarCarpetaRecursiva(gdPath);
        console.log('  ✓ Gestion_Documental eliminada');
    } else {
        console.log('  → uploads/Gestion_Documental/ no existe (ya limpia)');
    }

    // 2b. Archivos sueltos en uploads/temp/
    const tempPath = path.join(uploadsDir, 'temp');
    if (fs.existsSync(tempPath)) {
        console.log('');
        console.log('  Limpiando uploads/temp/...');
        const t = vaciarCarpeta(tempPath);
        totalArchivosEliminados += t;
        if (t > 0) {
            console.log(`  ✓ ${t} archivo(s) temporales eliminados`);
        } else {
            console.log('  → uploads/temp/ ya estaba vacía');
        }
    }

    // 2c. Archivos sueltos en raíz de uploads/
    console.log('');
    console.log('  Limpiando archivos sueltos en uploads/...');
    const sueltos = vaciarCarpeta(uploadsDir);
    totalArchivosEliminados += sueltos;
    if (sueltos > 0) {
        console.log(`  ✓ ${sueltos} archivo(s) sueltos eliminados`);
    } else {
        console.log('  → No había archivos sueltos en uploads/');
    }

    // ── Resumen final ─────────────────────────────────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                  LIMPIEZA COMPLETADA                 ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Archivos físicos eliminados: ${String(totalArchivosEliminados).padEnd(23)}║`);
    console.log('║  Base de datos: ✓ limpia                             ║');
    console.log('║  Secuencias:    ✓ reiniciadas                        ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('El sistema está listo para crear nuevos expedientes.');
    console.log('');
}

limpiarTodo().catch(err => {
    console.error('Error inesperado:', err.message);
    process.exit(1);
});
