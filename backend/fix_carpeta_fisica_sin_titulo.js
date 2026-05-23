/**
 * fix_carpeta_fisica_sin_titulo.js
 * 
 * Busca y renombra FÍSICAMENTE la carpeta "Sin Título" en OneDrive.
 * La BD ya está limpia — este script corrige solo el disco.
 * 
 * Uso: node fix_carpeta_fisica_sin_titulo.js
 * 
 * El script detecta cuál es el nombre correcto consultando en la BD
 * el expediente cuya carpeta de documentos contiene "Sin Título".
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

// ── Buscar recursivamente carpetas llamadas "Sin Título" ────────────────────
function findSinTitulo(baseDir, results = [], depth = 0) {
    if (depth > 6 || !fs.existsSync(baseDir)) return results;
    let items;
    try { items = fs.readdirSync(baseDir); } catch(e) { return results; }
    for (const item of items) {
        const fullPath = path.join(baseDir, item);
        let stat;
        try { stat = fs.statSync(fullPath); } catch(e) { continue; }
        if (stat.isDirectory()) {
            if (item === 'Sin Título') {
                results.push(fullPath);
            } else {
                findSinTitulo(fullPath, results, depth + 1);
            }
        }
    }
    return results;
}

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('   FIX FÍSICO: CARPETAS "Sin Título" EN ONEDRIVE  ');
    console.log('══════════════════════════════════════════════════\n');

    // 1. Leer storage_path
    const cfgRes = await pool.query(`SELECT value FROM system_settings WHERE key = 'storage_path'`);
    const storagePath = cfgRes.rows[0]?.value;

    if (!storagePath || !fs.existsSync(storagePath)) {
        console.error(`❌ storage_path no encontrado o no existe: "${storagePath}"`);
        await pool.end(); return;
    }
    console.log(`📦 Buscando en: ${storagePath}\n`);

    // 2. Encontrar todas las carpetas "Sin Título"
    const sinTituloDirs = findSinTitulo(storagePath);

    if (sinTituloDirs.length === 0) {
        console.log('✅ No se encontraron carpetas "Sin Título" en disco. ¡Todo limpio!');
        await pool.end(); return;
    }

    console.log(`📂 Carpetas "Sin Título" encontradas: ${sinTituloDirs.length}\n`);

    for (const carpeta of sinTituloDirs) {
        console.log(`\n🔍 Procesando: ${carpeta}`);

        // 3. Buscar en BD algún documento cuya ruta contenga esta carpeta
        const docRes = await pool.query(`
            SELECT d.id as doc_id, d.path, d.expediente_id,
                   e.id, e.title, e.expediente_code, e.metadata_values
            FROM documents d
            JOIN expedientes e ON e.id = d.expediente_id
            WHERE d.path ILIKE $1
            LIMIT 1
        `, [`%Sin Título%`]);

        let nuevoNombre = null;

        if (docRes.rows.length > 0) {
            const exp = docRes.rows[0];
            let meta = {};
            try { meta = typeof exp.metadata_values === 'string' ? JSON.parse(exp.metadata_values) : (exp.metadata_values || {}); } catch(e) {}

            // Usar title si ya fue corregido, sino usar metadatos
            nuevoNombre = (
                (exp.title && exp.title !== 'Sin Título' ? exp.title : null) ||
                meta.valor4 || meta.valor1 || meta['Metadato 4'] || meta['Metadato 1'] || exp.expediente_code
            )?.trim().replace(/[<>:"/\\|?*]/g, '');

            console.log(`   📋 Expediente encontrado en BD: ID=${exp.id}, title="${exp.title}"`);
            console.log(`   🏷️  Nombre correcto determinado: "${nuevoNombre}"`);
        } else {
            // Intentar deducir del nombre de la carpeta padre o de documentos sin expediente
            const parentDir = path.dirname(carpeta);
            console.log(`   ⚠️  No se encontró expediente en BD con path que contenga "Sin Título".`);
            console.log(`   Carpeta padre: ${parentDir}`);
            console.log(`   → Ingrese el nombre correcto manualmente como argumento:`);
            console.log(`     node fix_carpeta_fisica_sin_titulo.js "NOMBRE_CORRECTO"\n`);
            
            // Usar argumento de línea de comandos si se pasó
            if (process.argv[2]) {
                nuevoNombre = process.argv[2].trim().replace(/[<>:"/\\|?*]/g, '');
                console.log(`   ✅ Usando nombre del argumento: "${nuevoNombre}"`);
            }
        }

        if (!nuevoNombre) {
            console.log(`   ❌ No se pudo determinar el nombre correcto. Saltando.\n`);
            continue;
        }

        // 4. Renombrar físicamente
        const nuevaCarpeta = path.join(path.dirname(carpeta), nuevoNombre);

        if (fs.existsSync(nuevaCarpeta)) {
            console.log(`   ⚠️  Ya existe una carpeta con el nombre "${nuevoNombre}". No se renombrará.`);
        } else {
            try {
                fs.renameSync(carpeta, nuevaCarpeta);
                console.log(`   ✅ RENOMBRADO FÍSICO: "${path.basename(carpeta)}" → "${nuevoNombre}"`);
            } catch (err) {
                console.error(`   ❌ Error físico: ${err.message}`);
                console.log(`   → Intente manualmente renombrar:\n   DESDE: ${carpeta}\n   HACIA: ${nuevaCarpeta}`);
                continue;
            }
        }

        // 5. Actualizar paths en la BD
        const docsUpdate = await pool.query(`
            SELECT id, path FROM documents WHERE path ILIKE $1
        `, [`%Sin Título%`]);

        let actualizados = 0;
        for (const doc of docsUpdate.rows) {
            const newPath = doc.path.replace(/Sin Título/g, nuevoNombre);
            await pool.query(`UPDATE documents SET path = $1 WHERE id = $2`, [newPath, doc.id]);
            actualizados++;
        }
        console.log(`   ✅ ${actualizados} rutas de documentos actualizadas en BD.`);
    }

    await pool.end();
    console.log('\n══════════════════════════════════════════════════');
    console.log('✅ Proceso completado.');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('❌ Error fatal:', e.message);
    pool.end();
    process.exit(1);
});
