require('dotenv').config();
const db = require('./database.js');
const path = require('path');

async function testPathGeneration(subseriesCode) {
    const query = `
        SELECT 
            s.subseries_code, s.subseries_name, s.folder_hierarchy as sub_hierarchy,
            ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
            org.section_code, org.subsection_code, org.regional_code, org.center_code,
            org.storage_path, org.entity_name, org.regional_name, org.center_name,
            ser.id as series_id, s.id as id, org.id as dependency_id
        FROM trd_subseries s
        LEFT JOIN trd_series ser ON s.series_id = ser.id
        LEFT JOIN organization_structure org ON ser.dependency_id = org.id
        WHERE s.subseries_code = ? OR s.subseries_name = ?
        LIMIT 1
    `;

    db.get(query, [subseriesCode, subseriesCode], async (err, trdInfo) => {
        if (err || !trdInfo) {
            console.error("Not found or error", err);
            return;
        }

        const globalHierarchy = null; // await getSystemSetting('folder_hierarchy');
        let hierarchy = [];
        try {
            const raw = trdInfo?.sub_hierarchy || trdInfo?.ser_hierarchy || globalHierarchy;
            hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
        } catch (e) { hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }]; }

        let metaValues = { 'valor1': 'PruebaExpediente', 'valor3': 'PruebaValor3', 'valor4': 'PruebaValor4' };
        const expediente = { title: 'Mi Expediente de Prueba' };

        const getCleanSuffix = (fullCode, separator) => {
            if (!fullCode) return '';
            const parts = String(fullCode).split(separator);
            return parts[parts.length - 1].replace(/[.-]/g, '');
        };

        const regCode = trdInfo?.regional_code || '68';
        const ctrCode = trdInfo?.center_code || '9224';
        const serieSuffix = getCleanSuffix(trdInfo?.series_code, '-');
        const subserieSuffix = getCleanSuffix(trdInfo?.subseries_code, '.');
        const typologyValue = '4';

        const rawLevels = hierarchy.map(level => {
            let value = '';
            const type = level.type;

            if (type === 'reg') value = regCode;
            else if (type === 'ctr') value = ctrCode;
            else if (type === 'dep') value = trdInfo?.section_code || trdInfo?.subsection_code || 'DEP';
            else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
            else if (type === 'ser') value = trdInfo?.series_code || 'SERIE';
            else if (type === 'ser_name') value = trdInfo?.series_name || 'SERIE';
            else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
            else if (type === 'sub') value = trdInfo?.subseries_code || 'SUBSERIE';
            else if (type === 'sub_name') value = trdInfo?.subseries_name || 'SUBSERIE';
            else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
            else if (type === 'typ_val' || type === 'meta_4') {
                value = (type === 'meta_4' && metaValues['valor4']) ? metaValues['valor4'] : String(typologyValue || '4');
            }
            else if (type === 'meta_1') value = expediente.title || metaValues['valor1'] || 'Expediente';
            else if (type.startsWith('meta_')) {
                const idx = type.split('_')[1];
                value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`];
            }
            
            return String(value || '')
                .replace(/[.-]/g, '') 
                .replace(/[<>:"/\\|?*]/g, '') 
                .trim();
        });

        const pathParts = [];
        if (rawLevels[0]) pathParts.push(rawLevels[0]); 
        if (rawLevels[1]) pathParts.push(rawLevels[1]); 
        
        const trdGroup = rawLevels.slice(2, 5).filter(v => v).join(' ');
        if (trdGroup) pathParts.push(trdGroup);
        
        if (rawLevels.length > 5) {
            pathParts.push(...rawLevels.slice(5));
        }

        const basePath = trdInfo?.storage_path || 'C:\\OneDrive_Base';
        const expDir = path.join(basePath, ...pathParts);
        
        console.log("Subseries:", trdInfo.subseries_code);
        console.log("Hierarchy Config:", hierarchy);
        console.log("Raw Levels:", rawLevels);
        console.log("Final Generated Path:", expDir);
    });
}

testPathGeneration('68.9224.2-42.29');
