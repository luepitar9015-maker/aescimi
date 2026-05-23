/**
 * renombrar_por_codigo.js
 * Busca el expediente por código, muestra sus metadatos
 * y renombra la carpeta física "Sin Título" con el nombre correcto.
 * 
 * Uso: node renombrar_por_codigo.js 2025EX-035703
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

const codigoArg = process.argv[2] || '2025EX-035703';

function findSinTitulo(baseDir, results = [], depth = 0) {
    if (depth > 8 || !fs.existsSync(baseDir)) return results;
    let items;
    try { items = fs.readdirSync(baseDir); } catch(e) { return results; }
    for (const item of items) {
        const fullPath = path.join(baseDir, item);
        let stat;
        try { stat = fs.statSync(fullPath); } catch(e) { continue; }
        if (stat.isDirectory()) {
            if (item === 'Sin Título') results.push(fullPath);
            else findSinTitulo(fullPath, results, depth + 1);
        }
    }
    return results;
}

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(`   EXPEDIENTE: ${codigoArg}`);
    console.log('══════════════════════════════════════════════════\n');

    // 1. Buscar expediente en BD
    const expRes = await pool.query(`
        SELECT 
            e.id, e.title, e.expediente_code, e.subserie,
            e.opening_date, e.metadata_values, e.storage_type,
            sub.subseries_name, sub.subseries_code, sub.folder_hierarchy as sub_hier,
            ser.series_name, ser.series_code, ser.folder_hierarchy as ser_hier,
            org.regional_code, org.center_code, org.section_code,
            org.storage_path as org_storage
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series ser ON sub.series_id = ser.id
        LEFT JOIN organization_structure org ON ser.dependency_id = org.id
        WHERE e.expediente_code ILIKE $1
        LIMIT 1
    `, [`%${codigoArg}%`]);

    if (expRes.rows.length === 0) {
        console.error(`❌ No se encontró el expediente con código: "${codigoArg}"`);
        await pool.end(); return;
    }

    const exp = expRes.rows[0];
    let meta = {};
    try { meta = typeof exp.metadata_values === 'string' ? JSON.parse(exp.metadata_values) : (exp.metadata_values || {}); } catch(e) {}

    console.log('📋 DATOS DEL EXPEDIENTE EN BASE DE DATOS:');
    console.log('┌─────────────────────────────────────────────────────');
    console.log(`│ ID:              ${exp.id}`);
    console.log(`│ Código:          ${exp.expediente_code}`);
    console.log(`│ Título actual:   "${exp.title}"`);
    console.log(`│ Subserie:        ${exp.subserie}`);
    console.log(`│ Nombre Serie:    ${exp.series_name || '-'}`);
    console.log(`│ Nombre Subserie: ${exp.subseries_name || '-'}`);
    console.log(`│ Tipo Almac.:     ${exp.storage_type || '-'}`);
    console.log(`│ Fecha Apertura:  ${exp.opening_date || '-'}`);
    console.log(`│ Regional:        ${exp.regional_code || '-'}`);
    console.log(`│ Centro:          ${exp.center_code || '-'}`);
    console.log('├─────────────────────────────────────────────────────');
    console.log('│ METADATOS INDEXADOS:');

    const metaEntries = Object.entries(meta).filter(([,v]) => v !== null && v !== undefined);
    if (metaEntries.length === 0) {
        console.log('│   (sin metadatos)');
    } else {
        metaEntries.forEach(([k, v]) => {
            console.log(`│   ${k.padEnd(20)} → "${v}"`);
        });
    }
    console.log('└─────────────────────────────────────────────────────\n');

    // 2. Determinar nombre correcto de carpeta
    // Prioridad: title (si no es 'Sin Título') > valor4 > valor1 > expediente_code
    const nuevoNombre = (
        (exp.title && exp.title !== 'Sin Título' && exp.title !== '' ? exp.title : null) ||
        meta.valor4 || meta.valor1 || meta['Metadato 4'] || meta['Metadato 1'] ||
        exp.expediente_code
    )?.trim().replace(/[<>:"/\\|?*]/g, '');

    console.log(`🏷️  NOMBRE CORRECTO PARA LA CARPETA: "${nuevoNombre}"\n`);

    // 3. Obtener storage_path
    const cfgRes = await pool.query(`SELECT value FROM system_settings WHERE key = 'storage_path'`);
    const storagePath = cfgRes.rows[0]?.value;
    console.log(`📦 Ruta base: ${storagePath}\n`);

    // 4. Buscar carpetas "Sin Título" en disco
    const sinTituloDirs = findSinTitulo(storagePath);

    if (sinTituloDirs.length === 0) {
        console.log('✅ No hay carpetas "Sin Título" en disco.');
        // Actualizar solo la BD si el título está mal
        if (exp.title === 'Sin Título' || !exp.title) {
            await pool.query(`UPDATE expedientes SET title = $1 WHERE id = $2`, [nuevoNombre, exp.id]);
            console.log(`✅ Título actualizado en BD: "${nuevoNombre}"`);
        }
        await pool.end(); return;
    }

    console.log(`📂 Carpetas "Sin Título" encontradas en disco: ${sinTituloDirs.length}`);
    sinTituloDirs.forEach((c, i) => console.log(`   ${i+1}. ${c}`));
    console.log('');

    // 5. Renombrar cada una
    for (const carpeta of sinTituloDirs) {
        const nuevaCarpeta = path.join(path.dirname(carpeta), nuevoNombre);
        console.log(`🔄 Renombrando:`);
        console.log(`   DESDE: ${carpeta}`);
        console.log(`   HACIA: ${nuevaCarpeta}`);

        if (fs.existsSync(nuevaCarpeta)) {
            console.log(`   ⚠️  Ya existe la carpeta "${nuevoNombre}". Fusionando archivos...`);
            // Mover archivos al directorio destino
            const archivos = fs.readdirSync(carpeta);
            for (const archivo of archivos) {
                const src = path.join(carpeta, archivo);
                const dst = path.join(nuevaCarpeta, archivo);
                if (!fs.existsSync(dst)) {
                    fs.renameSync(src, dst);
                    console.log(`   ✅ Movido: ${archivo}`);
                } else {
                    console.log(`   ⚠️  Ya existe: ${archivo} — no se sobreescribe`);
                }
            }
            // Eliminar carpeta vacía si quedó vacía
            if (fs.readdirSync(carpeta).length === 0) fs.rmdirSync(carpeta);
        } else {
            try {
                fs.renameSync(carpeta, nuevaCarpeta);
                console.log(`   ✅ Renombrado exitosamente.`);
            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
                continue;
            }
        }

        // 6. Actualizar paths en BD
        const docsRes = await pool.query(`
            SELECT id, path FROM documents WHERE path ILIKE '%Sin Título%'
        `);
        let actualizados = 0;
        for (const doc of docsRes.rows) {
            const newPath = doc.path.replace(/Sin Título/g, nuevoNombre);
            await pool.query(`UPDATE documents SET path = $1 WHERE id = $2`, [newPath, doc.id]);
            actualizados++;
        }
        if (actualizados > 0) console.log(`   ✅ ${actualizados} rutas de documentos actualizadas en BD.`);
    }

    // 7. Actualizar título del expediente en BD si estaba mal
    if (exp.title === 'Sin Título' || !exp.title) {
        await pool.query(`UPDATE expedientes SET title = $1 WHERE id = $2`, [nuevoNombre, exp.id]);
        console.log(`\n✅ Título del expediente actualizado en BD: "${nuevoNombre}"`);
    } else {
        console.log(`\nℹ️  Título en BD ya correcto: "${exp.title}"`);
    }

    await pool.end();
    console.log('\n══════════════════════════════════════════════════');
    console.log('✅ Proceso completado exitosamente.');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('❌ Error fatal:', e.message);
    pool.end();
    process.exit(1);
});
