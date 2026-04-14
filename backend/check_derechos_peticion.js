require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function check() {
    console.log('\n========================================');
    console.log('   DERECHOS DE PETICION - TRD CONFIG');
    console.log('========================================\n');

    // 1. Ver todas las series de Derechos de Petición
    const series = await pool.query(`
        SELECT s.id, s.series_code, s.series_name, s.folder_hierarchy,
               o.id as dep_id, o.section_code, o.section_name,
               o.regional_code, o.center_code, o.storage_path
        FROM trd_series s
        LEFT JOIN organization_structure o ON s.dependency_id = o.id
        WHERE UPPER(s.series_name) LIKE '%DERECHO%PETICI%'
        ORDER BY s.series_code
    `);

    console.log(`✅ Series encontradas: ${series.rows.length}\n`);
    series.rows.forEach(s => {
        console.log(`--- Serie ID: ${s.id} ---`);
        console.log(`  Código:       ${s.series_code}`);
        console.log(`  Nombre:       ${s.series_name}`);
        console.log(`  folder_hierarchy: ${s.folder_hierarchy || '⚠ NULL (usa config global)'}`);
        console.log(`  Dependencia:  ID=${s.dep_id} | section_code=${s.section_code} | ${s.section_name}`);
        console.log(`  Regional:     ${s.regional_code}`);
        console.log(`  Centro:       ${s.center_code}`);
        console.log(`  storage_path: ${s.storage_path || 'NULL'}`);
        console.log('');
    });

    // 2. Ver configuración global de jerarquía
    const global = await pool.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('folder_hierarchy', 'storage_path')
        ORDER BY key
    `);

    console.log('========================================');
    console.log('   CONFIGURACIÓN GLOBAL DEL SISTEMA');
    console.log('========================================');
    global.rows.forEach(r => {
        console.log(`  ${r.key}: ${r.value}`);
    });
    console.log('');

    // 3. Simular exactamente la ruta que generaría para un expediente de Derechos de Petición
    console.log('========================================');
    console.log('   SIMULACIÓN DE RUTA DE CARPETA');
    console.log('========================================');

    const globalHierarchy = global.rows.find(r => r.key === 'folder_hierarchy')?.value;
    const globalStoragePath = global.rows.find(r => r.key === 'storage_path')?.value;

    series.rows.forEach(s => {
        const raw = s.folder_hierarchy || globalHierarchy;
        let hierarchy = [];
        try {
            hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_4' }];
        } catch(e) {
            hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_4' }];
        }

        const regCode = s.regional_code || '68';
        const ctrCode = s.center_code || '9224';

        const getCleanSuffix = (fullCode, sep) => {
            if (!fullCode) return '';
            const parts = String(fullCode).split(sep);
            return parts[parts.length - 1].replace(/[.-]/g, '');
        };

        const serieSuffix = getCleanSuffix(s.series_code, '-');

        const exampleMeta4 = '2026';  // ejemplo de Valor 4

        const resolveLevel = (type) => {
            if (type === 'reg') return regCode;
            if (type === 'ctr') return ctrCode;
            if (type === 'dep') return s.section_code || 'DEP';
            if (type === 'dep_conc') return `${regCode}${ctrCode}`.replace(/[.-]/g, '');
            if (type === 'ser') return s.series_code || 'SERIE';
            if (type === 'ser_name') return s.series_name;
            if (type === 'ser_conc') return `${regCode}${ctrCode}${serieSuffix}`.replace(/[.-]/g, '');
            if (type === 'meta_4') return exampleMeta4;
            if (type.startsWith('meta_')) return `[Metadato_${type.split('_')[1]}]`;
            return type;
        };

        const levels = hierarchy.map(h => resolveLevel(h.type)).filter(v => v && v.trim() !== '');
        const basePath = globalStoragePath || s.storage_path || '/almacenamiento/GD';
        const fullPath = [basePath, ...levels].join('/');

        console.log(`\n📂 Serie: ${s.series_code} | ${s.series_name}`);
        console.log(`   Jerarquía: ${hierarchy.map(h => h.type).join(' → ')}`);
        console.log(`   Ruta generada:`);
        console.log(`   ${fullPath}/`);
        console.log(`      └── 01_DerechoDePeticion.pdf`);
    });

    await pool.end();
    console.log('\n========================================\n');
}

check().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
