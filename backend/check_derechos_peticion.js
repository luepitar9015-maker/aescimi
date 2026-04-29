require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const path = require('path');

// Acepta nombre de serie como argumento: node check_derechos_peticion.js "historia academica"
const serieArg = process.argv[2] || 'DERECHO DE PETICION';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function check() {
    const searchKeywords = serieArg.toUpperCase().split(' ').filter(w => w.length > 2);
    const likePattern = `%${searchKeywords.join('%')}%`;

    console.log('\n========================================');
    console.log(`   ${serieArg.toUpperCase()} - RUTAS REALES`);
    console.log('========================================\n');

    // 1. Configuración global
    const globalCfg = await pool.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('folder_hierarchy', 'storage_path')
        ORDER BY key
    `);
    const globalHierarchy = globalCfg.rows.find(r => r.key === 'folder_hierarchy')?.value;
    const globalStoragePath = globalCfg.rows.find(r => r.key === 'storage_path')?.value;

    // 2. Buscar la serie por nombre aproximado
    const series = await pool.query(`
        SELECT s.id, s.series_code, s.series_name, s.folder_hierarchy,
               o.section_code, o.regional_code, o.center_code, o.storage_path
        FROM trd_series s
        LEFT JOIN organization_structure o ON s.dependency_id = o.id
        WHERE UPPER(s.series_name) LIKE $1
        ORDER BY s.series_code
        LIMIT 1
    `, [likePattern]);

    if (series.rows.length === 0) {
        console.log(`❌ No se encontró ninguna serie con nombre "${serieArg}" en la TRD.`);
        console.log('   Verifique el nombre exacto en el módulo de Estructura y TRD.');
        await pool.end();
        return;
    }

    const serie = series.rows[0];
    console.log(`✅ Serie encontrada: ${serie.series_code} | ${serie.series_name}`);

    // 3. Expedientes reales de esa serie (toma los 10 más recientes)
    const expedientes = await pool.query(`
        SELECT e.id, e.title, e.expediente_code, e.subserie, e.metadata_values
        FROM expedientes e
        WHERE e.subserie ILIKE $1 OR e.subserie ILIKE $2
        ORDER BY e.id DESC
        LIMIT 10
    `, [`%${serie.series_code}%`, `%27%`]);

    console.log(`\n📋 Expedientes reales encontrados: ${expedientes.rows.length}`);

    // 4. Calcular rutas reales
    const rawHierarchy = serie.folder_hierarchy || globalHierarchy;
    let hierarchy = [];
    try {
        hierarchy = rawHierarchy ? JSON.parse(rawHierarchy) : [{ type: 'dep_conc' }, { type: 'ser_conc' }, { type: 'meta_4' }];
    } catch(e) {
        hierarchy = [{ type: 'dep_conc' }, { type: 'ser_conc' }, { type: 'meta_4' }];
    }

    const basePath = globalStoragePath || serie.storage_path || '/almacenamiento/GD';
    const regCode = serie.regional_code || '68';
    const ctrCode = serie.center_code || '9224';

    const getCleanSuffix = (fullCode, sep) => {
        if (!fullCode) return '';
        const parts = String(fullCode).split(sep);
        return parts[parts.length - 1].replace(/[.-]/g, '');
    };
    const serieSuffix = getCleanSuffix(serie.series_code, '-');

    console.log(`\n📐 Jerarquía configurada: ${hierarchy.map(h => h.label || h.type).join(' → ')}`);
    console.log(`📦 Ruta base: ${basePath}`);
    console.log('\n========================================');
    console.log('   CARPETAS QUE SE CREAN POR EXPEDIENTE');
    console.log('========================================');

    if (expedientes.rows.length === 0) {
        console.log('\n⚠️  No hay expedientes cargados aún para esta serie.');
        console.log('   Cuando se cargue el Excel con expedientes de Derechos de Petición,');
        console.log('   las carpetas se crearán automáticamente con el Valor 4 real.\n');
        
        // Simular con ejemplo
        const exampleValues = { valor4: 'EJEMPLO-2026' };
        const mockExp = { title: 'DERECHO DE PETICION EJEMPLO', metadata_values: exampleValues };
        printRuta(hierarchy, regCode, ctrCode, serieSuffix, basePath, mockExp, '(EJEMPLO SIMULADO)');
    } else {
        expedientes.rows.forEach((exp, i) => {
            let metaValues = {};
            try {
                metaValues = typeof exp.metadata_values === 'string'
                    ? JSON.parse(exp.metadata_values)
                    : (exp.metadata_values || {});
            } catch(e) { metaValues = {}; }

            printRuta(hierarchy, regCode, ctrCode, serieSuffix, basePath, 
                { title: exp.title, metadata_values: metaValues }, 
                `Exp #${exp.id} — ${exp.title?.substring(0, 40) || exp.expediente_code}`);
        });
    }

    await pool.end();
    console.log('\n========================================\n');
}

function printRuta(hierarchy, regCode, ctrCode, serieSuffix, basePath, exp, label) {
    let metaValues = {};
    try {
        metaValues = typeof exp.metadata_values === 'string'
            ? JSON.parse(exp.metadata_values)
            : (exp.metadata_values || {});
    } catch(e) { metaValues = {}; }

    const resolveLevel = (type) => {
        if (type === 'reg')      return regCode;
        if (type === 'ctr')      return ctrCode;
        if (type === 'dep_conc') return `${regCode}${ctrCode}`.replace(/[.-]/g, '');
        if (type === 'ser_conc') return `${regCode}${ctrCode}${serieSuffix}`.replace(/[.-]/g, '');
        if (type === 'meta_1')   return (exp.title || metaValues['valor1'] || metaValues['Metadato 1'] || '').replace(/[<>:"/\\|?*]/g, '').trim();
        if (type.startsWith('meta_')) {
            const idx = type.split('_')[1];
            return (metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '').replace(/[<>:"/\\|?*]/g, '').trim();
        }
        return type;
    };

    const levels = hierarchy.map(h => resolveLevel(h.type)).filter(v => v && v.trim() !== '');
    const fullPath = path.join(basePath, ...levels);

    console.log(`\n📂 ${label}`);
    console.log(`   Valores usados:`);
    hierarchy.forEach(h => {
        const val = resolveLevel(h.type);
        const labelH = h.label || h.type;
        const source = h.type.startsWith('meta_') 
            ? `valor${h.type.split('_')[1]} del expediente`
            : 'TRD/configuración';
        console.log(`     ${labelH.padEnd(30)} → "${val || '(vacío)'}"   [${source}]`);
    });
    console.log(`   📁 Carpeta creada:`);
    console.log(`   ${fullPath}\\`);
    console.log(`      └── 01_DerechoDePeticion.pdf`);
}

check().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
