/**
 * renombrar_carpeta_sin_titulo.js
 * 
 * Busca expedientes con title='Sin Título' en la BD, calcula
 * el nombre correcto usando los metadatos, renombra la carpeta
 * física en OneDrive y actualiza los paths en la BD.
 * 
 * Uso: node renombrar_carpeta_sin_titulo.js
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

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('   RENOMBRAR CARPETAS "Sin Título" EN ONEDRIVE    ');
    console.log('══════════════════════════════════════════════════\n');

    // 1. Obtener storage_path global
    const cfgRes = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ('storage_path', 'folder_hierarchy')`);
    const storagePath = cfgRes.rows.find(r => r.key === 'storage_path')?.value;
    const hierarchyRaw = cfgRes.rows.find(r => r.key === 'folder_hierarchy')?.value;

    if (!storagePath) {
        console.error('❌ No se encontró storage_path en system_settings.');
        await pool.end(); return;
    }
    console.log(`📦 Ruta base OneDrive: ${storagePath}`);

    // 2. Buscar todos los expedientes con title='Sin Título'
    const expRes = await pool.query(`
        SELECT 
            e.id, e.title, e.expediente_code, e.subserie, e.metadata_values,
            sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
            ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
            org.regional_code, org.center_code, org.section_code
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series ser ON sub.series_id = ser.id
        LEFT JOIN organization_structure org ON ser.dependency_id = org.id
        WHERE e.title = 'Sin Título' OR e.title IS NULL OR e.title = ''
        ORDER BY e.id DESC
    `);

    if (expRes.rows.length === 0) {
        console.log('✅ No hay expedientes con "Sin Título". ¡Todo limpio!');
        await pool.end(); return;
    }

    console.log(`📋 Encontrados ${expRes.rows.length} expediente(s) con "Sin Título":\n`);

    const getCleanSuffix = (fullCode, sep) => {
        if (!fullCode) return '';
        const parts = String(fullCode).split(sep);
        return parts[parts.length - 1].replace(/[.-]/g, '');
    };

    for (const exp of expRes.rows) {
        let meta = {};
        try { meta = typeof exp.metadata_values === 'string' ? JSON.parse(exp.metadata_values) : (exp.metadata_values || {}); } catch(e) {}

        // Determinar título correcto usando metadatos
        // Para Derechos de Petición: valor4 = radicado
        // Fallback: valor1, valor2, código de expediente
        const nuevoTitulo = (
            meta.valor4 || meta.valor3 || meta.valor1 ||
            meta['Metadato 4'] || meta['Metadato 1'] ||
            exp.expediente_code || null
        )?.trim();

        if (!nuevoTitulo) {
            console.log(`⚠️  Exp ID ${exp.id} (${exp.subserie}): No se puede determinar el título correcto. Metadatos: ${JSON.stringify(meta)}`);
            console.log(`   → Edítelo manualmente en la BD: UPDATE expedientes SET title='NOMBRE' WHERE id=${exp.id};\n`);
            continue;
        }

        console.log(`📂 Exp ID ${exp.id} | Subserie: ${exp.subserie}`);
        console.log(`   Título actual:  "Sin Título"`);
        console.log(`   Título nuevo:   "${nuevoTitulo}"`);

        // Reconstruir ruta actual (con "Sin Título") y nueva ruta
        const regCode = exp.regional_code || '68';
        const ctrCode = exp.center_code || '9224';
        const serieSuffix = getCleanSuffix(exp.series_code, '-');

        let hierarchy = [];
        try {
            const raw = exp.sub_hierarchy || exp.ser_hierarchy || hierarchyRaw;
            hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep_conc' }, { type: 'ser_conc' }, { type: 'meta_1' }];
        } catch(e) {
            hierarchy = [{ type: 'dep_conc' }, { type: 'ser_conc' }, { type: 'meta_1' }];
        }

        const resolveLevel = (type, useSinTitulo = false) => {
            if (type === 'dep_conc') return `${regCode}${ctrCode}`.replace(/[.-]/g, '');
            if (type === 'ser_conc') return `${regCode}${ctrCode}${serieSuffix}`.replace(/[.-]/g, '');
            if (type === 'meta_1')   return useSinTitulo ? 'Sin Título' : nuevoTitulo.replace(/[<>:"/\\|?*]/g, '').trim();
            if (type.startsWith('meta_')) {
                const idx = type.split('_')[1];
                return (meta[`valor${idx}`] || '').replace(/[<>:"/\\|?*]/g, '').trim();
            }
            return type;
        };

        const oldParts = hierarchy.map(h => resolveLevel(h.type, true)).filter(v => v && v.trim());
        const newParts = hierarchy.map(h => resolveLevel(h.type, false)).filter(v => v && v.trim());

        const oldDir = path.join(storagePath, ...oldParts);
        const newDir = path.join(storagePath, ...newParts);

        console.log(`   📁 Carpeta antigua: ${oldDir}`);
        console.log(`   📁 Carpeta nueva:   ${newDir}`);

        // Verificar que la carpeta antigua existe
        if (!fs.existsSync(oldDir)) {
            console.log(`   ⚠️  La carpeta antigua NO existe en disco. Solo se actualizará la BD.\n`);
        } else if (oldDir === newDir) {
            console.log(`   ✅ Las rutas son iguales, no se necesita renombrar.\n`);
        } else {
            try {
                fs.renameSync(oldDir, newDir);
                console.log(`   ✅ Carpeta física renombrada exitosamente.`);
            } catch (fsErr) {
                console.error(`   ❌ Error renombrando carpeta: ${fsErr.message}`);
                console.log(`   → Intente renombrar manualmente de:\n     ${oldDir}\n   → a:\n     ${newDir}\n`);
                continue;
            }
        }

        // Actualizar título en la BD
        await pool.query(`UPDATE expedientes SET title = $1 WHERE id = $2`, [nuevoTitulo, exp.id]);
        console.log(`   ✅ BD actualizada: title = "${nuevoTitulo}"`);

        // Actualizar paths de documentos en la BD
        const docsRes = await pool.query(`SELECT id, path FROM documents WHERE expediente_id = $1`, [exp.id]);
        let docsActualizados = 0;
        for (const doc of docsRes.rows) {
            if (doc.path && doc.path.includes(oldDir)) {
                const newPath = doc.path.replace(oldDir, newDir);
                await pool.query(`UPDATE documents SET path = $1 WHERE id = $2`, [newPath, doc.id]);
                docsActualizados++;
            } else if (doc.path && doc.path.includes('Sin Título')) {
                const newPath = doc.path.replace('Sin Título', nuevoTitulo.replace(/[<>:"/\\|?*]/g, '').trim());
                await pool.query(`UPDATE documents SET path = $1 WHERE id = $2`, [newPath, doc.id]);
                docsActualizados++;
            }
        }
        console.log(`   ✅ ${docsActualizados} documentos actualizados en BD.\n`);
    }

    await pool.end();
    console.log('══════════════════════════════════════════════════');
    console.log('✅ Proceso completado.');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('❌ Error fatal:', e.message);
    pool.end();
    process.exit(1);
});
