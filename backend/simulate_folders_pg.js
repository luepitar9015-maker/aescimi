require('dotenv').config();
const { pool } = require('./database_pg');

async function simulate() {
    console.log('=== SIMULACIÓN EXACTA DEL SISTEMA DERECHOS DE PETICIÓN ===\n');

    try {
        let globalStoragePath = 'C:\\Almacenamiento_CIMI';
        const settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'storage_path'");
        if (settingsRes.rows.length > 0) globalStoragePath = settingsRes.rows[0].value;

        // Fetch user's specified Derecho de Peticion expedientes
        const queryExp = `
            SELECT 
                e.id, e.title, e.metadata_values, e.subserie as subserie_val,
                sub.id as sub_id, sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
                ser.id as ser_id, ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                org.section_code, org.subsection_code, org.subsection_name, org.section_name,
                org.regional_code, org.center_code
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie = sub.subseries_name)
            LEFT JOIN trd_series ser ON sub.series_id = ser.id
            LEFT JOIN organization_structure org ON ser.dependency_id = org.id
            WHERE sub.subseries_name ILIKE '%peticio%' OR e.metadata_values LIKE '%7%'
            ORDER BY e.id DESC
            LIMIT 3;
        `;

        const { rows: expedientes } = await pool.query(queryExp);

        if (expedientes.length === 0) {
            console.log('No se encontraron expedientes con los criterios (Radicado 7 / Derecho de Petición).');
            return;
        }

        console.log('Resultados de Simulación (Lógica Nativa del Backend):\n');

        for (let i = 0; i < expedientes.length; i++) {
            const exp = expedientes[i];
            
            // 1. Fetch Typologies for Subseries
            let tipologias = [];
            if (exp.sub_id) {
                const { rows } = await pool.query("SELECT typology_name FROM trd_typologies WHERE subseries_id = $1 ORDER BY id ASC", [exp.sub_id]);
                tipologias = rows;
            } else if (exp.ser_id) {
                const { rows } = await pool.query("SELECT typology_name FROM trd_typologies WHERE series_id = $1 ORDER BY id ASC", [exp.ser_id]);
                tipologias = rows;
            }
            if (tipologias.length === 0) tipologias = [{ typology_name: 'DOCUMENTO_GENERAL' }];

            // 2. Parse Hierarchy manually set in GUI (sub_hierarchy or ser_hierarchy)
            let hierarchy = [];
            try {
                // We use EXACTLY what's configured in their Subseries
                const raw = exp.sub_hierarchy || exp.ser_hierarchy || '[{"type": "dep_conc"}, {"type": "ser_conc"}, {"type": "meta_4"}]';
                hierarchy = JSON.parse(raw);
            } catch (e) {
                hierarchy = [{"type": "dep_conc"}, {"type": "ser_conc"}, {"type": "meta_4"}];
            }

            let metaValues = {};
            try { metaValues = JSON.parse(exp.metadata_values || '{}'); } catch (e) {}

            const getCleanSuffix = (fullCode, separator) => {
                if (!fullCode) return '';
                const parts = String(fullCode).split(separator);
                return parts[parts.length - 1].replace(/[.-]/g, '');
            };

            const regCode = exp.regional_code || '68';
            const ctrCode = exp.center_code || '9224';
            const serieSuffix = getCleanSuffix(exp.series_code, '-');
            const subserieSuffix = getCleanSuffix(exp.subseries_code, '.');

            // 3. Map values following documents.js logic precisely
            const rawLevels = hierarchy.map(level => {
                let value = '';
                const type = level.type;

                if (type === 'reg') value = regCode;
                else if (type === 'ctr') value = ctrCode;
                else if (type === 'dep') value = exp.section_code || exp.subsection_code || 'DEP';
                else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
                else if (type === 'ser') value = exp.series_code || 'SERIE';
                else if (type === 'ser_name') value = exp.series_name || 'SERIE';
                else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
                else if (type === 'sub') value = exp.subseries_code || 'SUBSERIE';
                else if (type === 'sub_name') value = exp.subseries_name || 'SUBSERIE';
                else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
                else if (type === 'typ_val' || type === 'meta_4') {
                    value = metaValues['valor4'] || metaValues['Metadato 4'] || 'VALOR_NO_ENCONTRADO';
                }
                else if (type === 'meta_1') value = exp.title || metaValues['valor1'] || 'Expediente';
                else if (type.startsWith('meta_')) {
                    const idx = type.split('_')[1];
                    value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`];
                }
                
                return String(value || '')
                    .replace(/[.-]/g, '')
                    .replace(/[<>:"/\\|?*]/g, '') 
                    .trim();
            });

            // 4. Grouping logic from documents.js
            const pathParts = [];
            if (rawLevels[0]) pathParts.push(rawLevels[0]);
            if (rawLevels[1]) pathParts.push(rawLevels[1]);
            
            const trdGroup = rawLevels.slice(2, 5).filter(v => v).join(' ');
            if (trdGroup) pathParts.push(trdGroup);
            
            if (rawLevels.length > 5) {
                pathParts.push(...rawLevels.slice(5));
            }

            const expDir = [...pathParts].join('\\');
            
            console.log(`[Expediente]: ${exp.subseries_name || 'Serie'} - ID = ${exp.id}`);
            console.log(`   📂 Ruta (Carpeta Expediente): ${globalStoragePath}\\${expDir}`);
            console.log(`   📄 Archivos/Tipologías esperadas dentro de la carpeta:`);
            tipologias.forEach((tip, idx) => {
                const numStr = String(idx + 1).padStart(2, '0');
                const safeName = tip.typology_name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
                console.log(`      |- ${numStr}_${safeName}.pdf`);
            });
            console.log('   ---------------------------------------------------------------------');
        }

    } catch (err) {
        console.error('❌ Error executing:', err);
    } finally {
        pool.end();
    }
}

simulate();
