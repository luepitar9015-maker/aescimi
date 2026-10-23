const express = require('express');
const router = express.Router();
const db = require('../database');
const xlsx = require('xlsx');

const correctMetadata = (metadata) => {
    if (!metadata) return {};
    let meta = { ...metadata };
    let v1 = meta.valor1 || '';
    let v3 = meta.valor3 || '';

    const v1Clean = String(v1).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const v3Clean = String(v3).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (v1Clean === 'tecnico' && v3Clean.startsWith('tecnologo')) {
        meta.valor1 = 'TECNÓLOGO';
    }
    return meta;
};

// GET Template for Mass Upload Expedientes
router.get('/template', (req, res) => {
    const wb = xlsx.utils.book_new();

    // Sheet 1: Plantilla_Expedientes
    const headers = [
        'Codigo Expediente', 
        'Id Caja', 
        'Fecha Apertura', 
        'Subserie', 
        'Tipo Almacenamiento', 
        'Titulo',
        'Responsable',
        'Valor 1', 'Valor 2', 'Valor 3', 'Valor 4',
        'Valor 5', 'Valor 6', 'Valor 7', 'Valor 8'
    ];
    
    // Example data
    const examples = [
        ['EXP-2026-001', 'CAJA-01', '2026-01-15', '200.1.01', 'Fisico', 'Expediente de Prueba 1', 'Luis Ernesto Parada Moreno', 'Meta 1', 'Meta 2', '', '', '', '', '', ''],
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, ...examples]);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 25 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Plantilla_Expedientes');

    // Sheet 2: Instrucciones
    const instrucciones = [
        ['INSTRUCCIONES PARA DILIGENCIAR LA PLANTILLA DE EXPEDIENTES'],
        [''],
        ['COLUMNA', 'DESCRIPCION', 'OBLIGATORIO', 'EJEMPLO'],
        ['Codigo Expediente', 'Código de identificación del expediente', 'NO', 'EXP-2026-001'],
        ['Id Caja', 'Identificador de la caja física', 'NO', 'CAJA-01'],
        ['Fecha Apertura', 'Fecha en formato YYYY-MM-DD', 'SI', '2026-01-15'],
        ['Subserie', 'Código de la Subserie o Serie según la TRD', 'SI', '200.1.01'],
        ['Tipo Almacenamiento', 'Fisico o Digital', 'SI', 'Fisico'],
        ['Titulo', 'Nombre descriptivo del expediente', 'SI', 'Expediente de Personal - Juan Perez'],
        ['Responsable', 'Nombre, documento o correo del responsable asignado', 'NO', 'Luis Ernesto Parada Moreno'],
        ['Valor 1 - 8', 'Metadatos adicionales según la configuración de la Subserie', 'NO', 'Valor'],
        [''],
        ['REGLAS DE CREACIÓN MASIVA:'],
        ['1. No modifique los nombres de las cabeceras en la hoja Plantilla_Expedientes.'],
        ['2. La columna Subserie es crítica para que el sistema asocie los metadatos correctamente.'],
        ['3. Si carga metadatos personalizados, asegúrese de que la Subserie seleccionada los use.'],
        [''],
        ['REGLAS DE ACTUALIZACIÓN MASIVA DE CÓDIGOS (NUEVO PENDIENTE):'],
        ['1. Use esta misma plantilla llenando ÚNICAMENTE el "Titulo" o "Valor 1" (para buscar) y el "Codigo Expediente" (el nuevo código).'],
        ['2. Importe el archivo desde expedientes usando el botón "Actualizar Códigos".'],
    ];
    const wsInstr = xlsx.utils.aoa_to_sheet(instrucciones);
    wsInstr['!cols'] = [{ wch: 20 }, { wch: 80 }, { wch: 14 }, { wch: 32 }];
    xlsx.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Creacion_Expedientes.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

// GET expedientes for FUID document inventory
router.get('/inventario-fuid', (req, res) => {
    const baseQuery = `
        SELECT 
            e.id, 
            e.expediente_code, 
            e.title, 
            e.box_id, 
            e.storage_type,
            e.subserie,
            TO_CHAR(MIN(COALESCE(d.document_date, d.created_at)), 'YYYY-MM-DD') as fecha_inicio,
            TO_CHAR(MAX(COALESCE(d.document_date, d.created_at)), 'YYYY-MM-DD') as fecha_fin,
            COUNT(d.id) as doc_count
        FROM expedientes e
        INNER JOIN documents d ON d.expediente_id = e.id
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series s ON (e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
    `;

    const groupOrder = `
        GROUP BY e.id, sub.id, s.id
        ORDER BY e.created_at DESC
    `;

    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
            if (perms.length === 0) return res.json({ data: [] });

            const seriesIds = perms.map(p => p.series_id).filter(Boolean);
            const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);

            const paramSeriesIds = seriesIds.length > 0 ? seriesIds : [-1];
            const paramSubseriesIds = subseriesIds.length > 0 ? subseriesIds : [-1];

            const filteredQuery = `
                ${baseQuery}
                WHERE (
                    s.id = ANY($1::int[])
                    OR sub.id = ANY($2::int[])
                    OR (s.series_name IS NOT NULL AND s.series_name IN (
                        SELECT ps.series_name FROM trd_series ps WHERE ps.id = ANY($1::int[]) AND ps.series_name IS NOT NULL
                    ))
                    OR (sub.subseries_name IS NOT NULL AND sub.subseries_name IN (
                        SELECT pss.subseries_name FROM trd_subseries pss WHERE pss.id = ANY($2::int[]) AND pss.subseries_name IS NOT NULL
                    ))
                )
                ${groupOrder}
            `;

            db.all(filteredQuery, [paramSeriesIds, paramSubseriesIds], (err, rows) => {
                if (err) {
                    console.error("FUID query error (filtered):", err);
                    return res.status(500).json({ error: 'Error al obtener inventario.' });
                }
                res.json({ data: rows });
            });
        });
        return;
    }

    const finalQuery = `
        ${baseQuery}
        ${groupOrder}
    `;

    db.all(finalQuery, [], (err, rows) => {
        if (err) {
            console.error("FUID query error:", err);
            return res.status(500).json({ error: 'Error al obtener inventario.' });
        }
        res.json({ data: rows });
    });
});

// GET search expedientes
router.get('/search', (req, res) => {
    const term = req.query.term || '';
    const query = `
        SELECT e.*, MAX(sub.metadata_labels) as sub_labels, MAX(s.metadata_labels) as series_labels
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series s ON (e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
        WHERE (e.expediente_code ILIKE $1 
           OR e.title ILIKE $2 
           OR e.subserie ILIKE $3 
           OR e.box_id ILIKE $4
           OR e.metadata_values ILIKE $5)
        GROUP BY e.id
        ORDER BY e.created_at DESC
    `;
    const searchPattern = `%${term}%`;
    
    let finalQuery = query;
    let finalParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];

    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
            if (perms.length === 0) return res.json({ data: [] });

            const seriesIds = perms.map(p => p.series_id).filter(Boolean);
            const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);

            const paramSeriesIds = seriesIds.length > 0 ? seriesIds : [-1];
            const paramSubseriesIds = subseriesIds.length > 0 ? subseriesIds : [-1];

            const filteredQuery = `
                SELECT e.*, MAX(sub.metadata_labels) as sub_labels, MAX(s.metadata_labels) as series_labels
                FROM expedientes e
                LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                LEFT JOIN trd_series s ON (e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
                WHERE (e.expediente_code ILIKE $3
                   OR e.title ILIKE $3
                   OR e.subserie ILIKE $3
                   OR e.box_id ILIKE $3
                   OR e.metadata_values ILIKE $3)
                AND (
                    s.id = ANY($1::int[])
                    OR sub.id = ANY($2::int[])
                    OR (s.series_name IS NOT NULL AND s.series_name IN (
                        SELECT ps.series_name FROM trd_series ps WHERE ps.id = ANY($1::int[]) AND ps.series_name IS NOT NULL
                    ))
                    OR (sub.subseries_name IS NOT NULL AND sub.subseries_name IN (
                        SELECT pss.subseries_name FROM trd_subseries pss WHERE pss.id = ANY($2::int[]) AND pss.subseries_name IS NOT NULL
                    ))
                )
                GROUP BY e.id
                ORDER BY e.created_at DESC
            `;
            db.all(filteredQuery, [paramSeriesIds, paramSubseriesIds, `%${term}%`], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error al buscar expedientes.' });
                const processed = rows.map(row => ({
                    ...row,
                    metadata_values: row.metadata_values ? correctMetadata(JSON.parse(row.metadata_values)) : {},
                    metadata_labels: row.sub_labels ? JSON.parse(row.sub_labels) : (row.series_labels ? JSON.parse(row.series_labels) : null)
                }));
                res.json({ data: processed });
            });
        });
        return;
    }

    db.all(query, finalParams, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(row => ({
            ...row,
            metadata_values: row.metadata_values ? correctMetadata(JSON.parse(row.metadata_values)) : {},
            metadata_labels: row.sub_labels ? JSON.parse(row.sub_labels) : (row.series_labels ? JSON.parse(row.series_labels) : null)
        }));
        res.json({ data: processed });
    });
});

// POST /hoja-control/:id - Actualizar metadatos y documentos de la Hoja de Control de un expediente
router.post('/hoja-control/:id', async (req, res) => {
    const { id } = req.params;
    const {
        regional_name,
        regional_code,
        center_name,
        center_code,
        section_name,
        section_code,
        responsable,
        documentos
    } = req.body;

    try {
        const { pool } = require('../database_pg');

        // 1. Obtener expediente actual
        const currentRes = await pool.query('SELECT * FROM expedientes WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado.' });
        }

        const currentExp = currentRes.rows[0];
        let metaObj = {};
        if (currentExp.metadata_values) {
            try {
                metaObj = typeof currentExp.metadata_values === 'string' ? JSON.parse(currentExp.metadata_values) : currentExp.metadata_values;
            } catch (e) {}
        }

        // Actualizar metadatos de Hoja de Control
        metaObj.responsable_hoja_control = responsable || '';
        metaObj.regional_code = regional_code || '';
        metaObj.center_code = center_code || '';
        metaObj.section_code = section_code || '';
        metaObj.hoja_control_documentos = documentos || [];

        // 2. Actualizar expedientes
        await pool.query(
            `UPDATE expedientes SET 
                regional = COALESCE($1, regional),
                centro = COALESCE($2, centro),
                dependencia = COALESCE($3, dependencia),
                metadata_values = $4
             WHERE id = $5`,
            [
                regional_name || null,
                center_name || null,
                section_name || null,
                JSON.stringify(metaObj),
                id
            ]
        );

        // 3. Procesar / actualizar los tipos documentales
        if (documentos && Array.isArray(documentos)) {
            for (const doc of documentos) {
                if (doc.id && typeof doc.id === 'number' && !doc.isManuallyAdded) {
                    // Documento existente en la BD -> Actualizar
                    await pool.query(
                        `UPDATE documents SET 
                            document_date = CASE WHEN $1 <> '' THEN $1::timestamp ELSE document_date END,
                            typology_name = COALESCE(NULLIF($2, ''), typology_name),
                            origen = COALESCE($3, origen)
                         WHERE id = $4`,
                        [doc.fecha || '', doc.tipo || '', doc.soporte || 'ELECTRONICO', doc.id]
                    ).catch(e => console.warn('[HOJA CONTROL] Warn actualizando documento:', e.message));
                } else if (doc.isManuallyAdded && doc.tipo) {
                    // Documento agregado manualmente -> Insertar
                    await pool.query(
                        `INSERT INTO documents (expediente_id, filename, typology_name, document_date, origen, status)
                         VALUES ($1, $2, $3, CASE WHEN $4 <> '' THEN $4::timestamp ELSE CURRENT_TIMESTAMP END, $5, 'Pendiente')`,
                        [id, doc.tipo, doc.tipo, doc.fecha || '', doc.soporte || 'ELECTRONICO']
                    ).catch(e => console.warn('[HOJA CONTROL] Warn insertando documento manual:', e.message));
                }
            }
        }

        res.json({
            success: true,
            message: 'Hoja de Control y expediente actualizados exitosamente.'
        });

    } catch (err) {
        console.error('[HOJA CONTROL] Error guardando Hoja de Control:', err);
        res.status(500).json({ error: `Error al guardar la Hoja de Control: ${err.message}` });
    }
});

// GET all expedientes
router.get('/', (req, res) => {
    const query = "SELECT * FROM expedientes ORDER BY created_at DESC";
    
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
            if (perms.length === 0) return res.json({ data: [] });

            const seriesIds = perms.map(p => p.series_id).filter(Boolean);
            const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);

            const paramSeriesIds = seriesIds.length > 0 ? seriesIds : [-1];
            const paramSubseriesIds = subseriesIds.length > 0 ? subseriesIds : [-1];

            const filteredQuery = `
                SELECT * FROM expedientes
                WHERE id IN (
                    SELECT e2.id FROM expedientes e2
                    LEFT JOIN trd_subseries sub ON (e2.subserie = sub.subseries_code OR e2.subserie LIKE '%-' || sub.subseries_code)
                    LEFT JOIN trd_series s ON (e2.subserie = s.series_code OR e2.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
                    WHERE (
                        s.id = ANY($1::int[])
                        OR sub.id = ANY($2::int[])
                        OR (s.series_name IS NOT NULL AND s.series_name IN (
                            SELECT ps.series_name FROM trd_series ps WHERE ps.id = ANY($1::int[]) AND ps.series_name IS NOT NULL
                        ))
                        OR (sub.subseries_name IS NOT NULL AND sub.subseries_name IN (
                            SELECT pss.subseries_name FROM trd_subseries pss WHERE pss.id = ANY($2::int[]) AND pss.subseries_name IS NOT NULL
                        ))
                    )
                    GROUP BY e2.id
                )
                ORDER BY created_at DESC
            `;

            db.all(filteredQuery, [paramSeriesIds, paramSubseriesIds], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error al obtener expedientes.' });
                const expedientes = rows.map(row => ({
                    ...row,
                    metadata_values: row.metadata_values ? correctMetadata(JSON.parse(row.metadata_values)) : {}
                }));
                res.json({ data: expedientes });
            });
        });
        return;
    }

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener expedientes.' });
        }
        const expedientes = rows.map(row => ({
            ...row,
            metadata_values: row.metadata_values ? correctMetadata(JSON.parse(row.metadata_values)) : {}
        }));
        res.json({ data: expedientes });
    });
});

// GET custom detailed expediente for Hoja Control
router.get('/detail/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT 
            e.id as expediente_id, e.title, e.expediente_code, e.metadata_values, e.storage_type,
            sub.subseries_name, sub.subseries_code,
            s.series_name, s.series_code,
            o.regional_name, o.regional_code,
            o.center_name, o.center_code,
            o.section_name, o.section_code
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series s ON (sub.series_id = s.id OR e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code)
        LEFT JOIN organization_structure o ON s.dependency_id = o.id
        WHERE e.id = ?
        LIMIT 1
    `;
    db.get(query, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Expediente no encontrado' });
        
        row.metadata_values = row.metadata_values ? correctMetadata(JSON.parse(row.metadata_values)) : {};
        res.json({ data: row });
    });
});

// POST create single expediente
router.post('/', (req, res) => {
    const { 
        expediente_code, 
        box_id, 
        opening_date, 
        subserie, 
        regional,
        centro,
        dependencia,
        storage_type, 
        title, 
        metadata_values 
    } = req.body;

    const query = `INSERT INTO expedientes (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        expediente_code, 
        box_id, 
        opening_date, 
        subserie, 
        regional,
        centro,
        dependencia,
        storage_type, 
        title, 
        JSON.stringify(correctMetadata(metadata_values || {}))
    ];

    db.run(query, params, function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ 
            message: 'Expediente creado exitosamente', 
            id: this.lastID,
            expediente: { id: this.lastID, ...req.body }
        });
    });
});

// POST mass create expedientes
router.post('/mass', async (req, res) => {
    let expedientes = [];
    let assignedUserIds = [];

    if (Array.isArray(req.body)) {
        expedientes = req.body;
    } else {
        expedientes = req.body.expedientes || [];
        assignedUserIds = req.body.assigned_user_ids || [];
    }

    if (expedientes.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
    }

    console.log(`[EXPEDIENTES] Recibida solicitud masiva con ${expedientes.length} registros. Asignaciones globales: ${assignedUserIds.length}`);

    const { pool } = require('../database_pg');
    const client = await pool.connect();
    const errors = [];
    const created_ids = [];
    let created = 0;
    let updatedCount = 0;

    try {
        await client.query('BEGIN');

        // Helper: normaliza cualquier formato de fecha a ISO o null
        const normalizeDate = (val) => {
            if (!val || val === '') return null;
            // Si es número (Excel serial)
            if (typeof val === 'number') {
                const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
            }
            const str = String(val).trim();
            // Formato DD/MM/YYYY (colombiano)
            const colMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (colMatch) return `${colMatch[3]}-${colMatch[2].padStart(2,'0')}-${colMatch[1].padStart(2,'0')}`;
            // Formato DD-MM-YYYY
            const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (dashMatch) return `${dashMatch[3]}-${dashMatch[2].padStart(2,'0')}-${dashMatch[1].padStart(2,'0')}`;
            // Cualquier otro formato — dejar que JS lo intente
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : str; // Si es válido, pasar tal cual (ISO)
        };

        for (let i = 0; i < expedientes.length; i++) {
            const exp = expedientes[i];
            
            const tituloLimpio = (exp.title || '').trim();

            const params = [
                exp.expediente_code || null,
                exp.box_id || null,
                normalizeDate(exp.opening_date),
                exp.subserie || null,
                exp.regional || null,
                exp.centro || null,
                exp.dependencia || null,
                exp.storage_type || null,
                tituloLimpio,
                JSON.stringify(correctMetadata(exp.metadata_values || {}))
            ];

            const savepointName = `sp_exp_${i}`;
            try {
                await client.query(`SAVEPOINT ${savepointName}`);
                
                let newId = null;
                let isUpdate = false;
                
                // Verificar si ya existe por expediente_code
                if (exp.expediente_code) {
                    const checkRes = await client.query(
                        `SELECT id FROM expedientes WHERE expediente_code = $1 LIMIT 1`,
                        [exp.expediente_code]
                    );
                    if (checkRes.rowCount > 0) {
                        newId = checkRes.rows[0].id;
                        isUpdate = true;
                    }
                }
                
                if (isUpdate) {
                    await client.query(
                        `UPDATE expedientes SET 
                            box_id = $1, 
                            opening_date = $2, 
                            subserie = $3, 
                            regional = $4, 
                            centro = $5, 
                            dependencia = $6, 
                            storage_type = $7, 
                            title = $8, 
                            metadata_values = $9 
                         WHERE id = $10`,
                        [
                            exp.box_id || null,
                            normalizeDate(exp.opening_date),
                            exp.subserie || null,
                            exp.regional || null,
                            exp.centro || null,
                            exp.dependencia || null,
                            exp.storage_type || null,
                            tituloLimpio,
                            JSON.stringify(correctMetadata(exp.metadata_values || {})),
                            newId
                        ]
                    );
                    updatedCount++;
                } else {
                    const result = await client.query(
                        `INSERT INTO expedientes 
                         (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                        params
                    );
                    newId = result.rows[0].id;
                    created++;
                }
                
                await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                
                if (newId) {
                    created_ids.push(newId);
                    
                    // Asignación individual (Opción B: Excel)
                    if (exp.assigned_user_id) {
                        await client.query(`
                            INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
                            VALUES ($1, $2, $3, $4)
                            ON CONFLICT (expediente_id, user_id) DO UPDATE
                                SET assigned_by = EXCLUDED.assigned_by,
                                    observaciones = EXCLUDED.observaciones,
                                    assigned_at = CURRENT_TIMESTAMP
                        `, [newId, exp.assigned_user_id, req.user?.id || null, 'Asignado/Actualizado en creación masiva (Excel)']);
                    }
                }
            } catch (err) {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                const errMsg = err.detail || err.message;
                console.error(`[EXPEDIENTES] Error insertando/actualizando "${exp.expediente_code || exp.title}": ${errMsg}`);
                errors.push({ expediente: exp.expediente_code || exp.title || `Fila ${i + 1}`, error: errMsg });
            }
        }

        // Asignación global (Opción A: Interfaz)
        if (assignedUserIds.length > 0 && created_ids.length > 0) {
            console.log(`[EXPEDIENTES] Insertando ${created_ids.length * assignedUserIds.length} asignaciones globales.`);
            for (const userId of assignedUserIds) {
                for (const expId of created_ids) {
                    await client.query(`
                        INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (expediente_id, user_id) DO UPDATE
                            SET assigned_by = EXCLUDED.assigned_by,
                                observaciones = EXCLUDED.observaciones,
                                assigned_at = CURRENT_TIMESTAMP
                    `, [expId, userId, req.user?.id || null, 'Asignado en creación masiva (Global)']);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`[EXPEDIENTES] Completado. ${created} creados, ${updatedCount} actualizados, ${errors.length} fallidos.`);
        res.json({
            message: `Procesado. ${created} creados, ${updatedCount} actualizados, ${errors.length} fallidos.`,
            errors,
            created_ids
        });

    } catch (fatalErr) {
        await client.query('ROLLBACK');
        console.error('[EXPEDIENTES] Error fatal en inserción masiva:', fatalErr);
        res.status(500).json({ error: 'Fallo crítico al guardar en base de datos: ' + fatalErr.message });
    } finally {
        client.release();
    }
});

// POST mass update expedientes (By Title/Metadata - Legacy support)
router.post('/mass-update', (req, res) => {
    const data = req.body; // Array of objects from Excel
    
    if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
    }

    const errors = [];
    const updated = [];
    let pending = data.length;

    console.log(`[EXPEDIENTES] Recibida solicitud de actualización masiva con ${data.length} registros.`);

    // Helper to finish
    const finish = () => {
        if (pending > 0) return;
        console.log(`[EXPEDIENTES] Actualización completada. ${updated.length} actualizados, ${errors.length} fallidos.`);
        res.json({ 
            message: `Procesado. ${updated.length} actualizados, ${errors.length} fallidos.`,
            updated: updated.length,
            errors: errors 
        });
    };

    data.forEach(item => {
        // Validar que venga el Código que queremos inyectar
        const newCode = item['Codigo Expediente'];
        const titleQuery = item['Titulo'] || '';
        const val1Query = item['Valor 1'] || '';
        const val2Query = item['Valor 2'] || '';

        if (!newCode || (!titleQuery && !val1Query)) {
            errors.push({ 
                item: titleQuery || val1Query || 'Desconocido', 
                error: 'Falta Código de Expediente o campos de búsqueda (Titulo/Valor 1)' 
            });
            pending--;
            finish();
            return;
        }

        let q = `SELECT id, expediente_code FROM expedientes WHERE title = $1`;
        let p = [titleQuery];

        if (!titleQuery && val1Query) {
            q = `SELECT id, expediente_code FROM expedientes WHERE (metadata_values::jsonb)->>'valor1' = $1 OR (metadata_values::jsonb)->>'Metadato 1' = $2`;
            p = [val1Query, val1Query];
        }

        db.all(q, p, (err, rows) => {
            if (err) {
                errors.push({ item: titleQuery || val1Query, error: 'Error consultando BD: ' + err.message });
                pending--;
                finish();
                return;
            }

            if (rows.length === 0) {
                errors.push({ item: titleQuery || val1Query, error: 'No se encontró ningún expediente coincidente' });
                pending--;
                finish();
                return;
            }

            if (rows.length > 1) {
                errors.push({ item: titleQuery || val1Query, error: 'Se encontraron múltiples expedientes con ese nombre/valor' });
                pending--;
                finish();
                return;
            }

            const expId = rows[0].id;
            
            db.run(`UPDATE expedientes SET expediente_code = $1 WHERE id = $2`, [newCode, expId], function(updateErr) {
                if (updateErr) {
                    errors.push({ item: titleQuery || val1Query, error: 'Error actualizando: ' + updateErr.message });
                } else {
                    updated.push({ id: expId, old: rows[0].expediente_code, new: newCode });
                }
                pending--;
                finish();
            });
        });
    });
});

// Helper de normalización para mapeo inteligente de columnas
const normField = (str) => {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s\-_]/g, '')
        .trim();
};

const normalizeDateVal = (val) => {
    if (!val || val === '') return null;
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    const colMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (colMatch) return `${colMatch[3]}-${colMatch[2].padStart(2,'0')}-${colMatch[1].padStart(2,'0')}`;
    const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) return `${dashMatch[3]}-${dashMatch[2].padStart(2,'0')}-${dashMatch[1].padStart(2,'0')}`;
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
};

// GET export editable template with existing expedientes data
router.get('/export-editable', async (req, res) => {
    try {
        const client = await (db.pool || db).connect();
        let expedientes = [];
        try {
            const expRes = await client.query(`
                SELECT id, expediente_code, box_id, opening_date, subserie, storage_type, title, metadata_values 
                FROM expedientes 
                ORDER BY id ASC
            `);
            expedientes = expRes.rows || [];
        } finally {
            client.release();
        }

        const wb = xlsx.utils.book_new();

        const rows = expedientes.map(exp => {
            let meta = {};
            try {
                meta = typeof exp.metadata_values === 'string' ? JSON.parse(exp.metadata_values || '{}') : (exp.metadata_values || {});
            } catch(e) {}

            const dateStr = exp.opening_date ? new Date(exp.opening_date).toISOString().split('T')[0] : '';

            return {
                "ID": exp.id,
                "Codigo Expediente": exp.expediente_code || '',
                "Id Caja": exp.box_id || '',
                "Fecha Apertura": dateStr,
                "Subserie TRD": exp.subserie || '',
                "Tipo Soporte": exp.storage_type || 'Fisico',
                "Titulo": exp.title || '',
                "Valor 1": meta.valor1 || '',
                "Valor 2": meta.valor2 || '',
                "Valor 3": meta.valor3 || '',
                "Valor 4": meta.valor4 || '',
                "Valor 5": meta.valor5 || '',
                "Valor 6": meta.valor6 || '',
                "Valor 7": meta.valor7 || '',
                "Valor 8": meta.valor8 || ''
            };
        });

        const ws = xlsx.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },  // ID
            { wch: 22 }, // Codigo Expediente
            { wch: 14 }, // Id Caja
            { wch: 15 }, // Fecha Apertura
            { wch: 16 }, // Subserie TRD
            { wch: 15 }, // Tipo Soporte
            { wch: 35 }, // Titulo
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];

        xlsx.utils.book_append_sheet(wb, ws, 'Expedientes_Para_Actualizar');

        const instr = [
            ['GUIA DE ACTUALIZACION MASIVA DE METADATOS Y EXPEDIENTES'],
            [''],
            ['1. NO MODIFIQUE LA COLUMNA "ID": El sistema usa este número para identificar exactamente el expediente.'],
            ['2. Modifique las columnas que necesite corregir (Código, Caja, Fecha, Título, o Metadatos Valor 1 a 8).'],
            ['3. Si deja una celda vacía, el sistema conservará el dato que ya tenía registrado (no lo borrará).'],
            ['4. Guarde el archivo y cárguelo en el sistema mediante el botón "Actualizar Metadatos (Excel)".'],
            ['5. El sistema le mostrará una pantalla de Vista Previa con el resumen exacto de los cambios antes de aplicarlos.']
        ];
        const wsInstr = xlsx.utils.aoa_to_sheet(instr);
        xlsx.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Expedientes_Para_Actualizacion_Masiva.xlsx"');
        res.send(buffer);

    } catch (err) {
        console.error('[EXPEDIENTES] Error en export-editable:', err);
        res.status(500).json({ error: 'Error al generar plantilla de actualización: ' + err.message });
    }
});

// POST mass update preview (Analyzes Excel data against DB and returns exact diff)
router.post('/mass-update-preview', async (req, res) => {
    const rawRows = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return res.status(400).json({ error: 'No se enviaron datos para analizar.' });
    }

    const client = await (db.pool || db).connect();
    try {
        // Fetch all subseries labels for friendly metadata naming
        const trdRes = await client.query('SELECT subseries_code, series_code, metadata_labels FROM trd_subseries');
        const trdLabelsMap = {};
        (trdRes.rows || []).forEach(r => {
            let meta = null;
            try {
                meta = typeof r.metadata_labels === 'string' ? JSON.parse(r.metadata_labels) : r.metadata_labels;
            } catch (e) {}
            if (meta) {
                if (r.subseries_code) trdLabelsMap[r.subseries_code] = meta;
                if (r.series_code) trdLabelsMap[r.series_code] = meta;
            }
        });

        const previewRows = [];
        let matchedCount = 0;
        let withChangesCount = 0;
        let unchangedCount = 0;
        let notFoundCount = 0;
        let ambiguousCount = 0;

        for (let idx = 0; idx < rawRows.length; idx++) {
            const item = rawRows[idx];
            const keys = Object.keys(item);

            const findKey = (synonyms) => {
                const normSyns = synonyms.map(normField);
                const foundKey = keys.find(k => normSyns.includes(normField(k)));
                return foundKey ? item[foundKey] : undefined;
            };

            const rowId = findKey(['id', 'idexpediente', 'identificador']);
            const rowCode = findKey(['codigoexpediente', 'codexp', 'nroexpediente', 'expediente', 'codigo']);
            const rowTitle = findKey(['titulo', 'nombreexpediente', 'asunto', 'descripcion', 'nombre', 'nombrecompleto']);
            const rowBox = findKey(['idcaja', 'caja', 'cajano', 'nocaja', 'boxid']);
            const rowDate = findKey(['fechaapertura', 'fechainicio', 'apertura', 'fecha']);
            const rowSubserie = findKey(['subserie', 'codsubserie', 'codigosubserie', 'trd', 'codtrd']);
            const rowStorage = findKey(['tipoalmacenamiento', 'tiposoporte', 'soporte']);

            const rowMeta = {};
            for (let m = 1; m <= 8; m++) {
                const mVal = findKey([`valor${m}`, `valor ${m}`, `metadato${m}`, `metadato ${m}`, `meta${m}`]);
                if (mVal !== undefined) {
                    rowMeta[`valor${m}`] = String(mVal).trim();
                }
            }

            // Find record in DB
            let query = '';
            let params = [];
            let matchType = '';

            const numId = parseInt(rowId, 10);
            if (!isNaN(numId) && numId > 0) {
                query = 'SELECT * FROM expedientes WHERE id = $1';
                params = [numId];
                matchType = `ID: ${numId}`;
            } else if (rowCode && String(rowCode).trim() !== '') {
                query = 'SELECT * FROM expedientes WHERE LOWER(TRIM(expediente_code)) = LOWER(TRIM($1))';
                params = [String(rowCode).trim()];
                matchType = `Código: ${rowCode}`;
            } else if (rowTitle && String(rowTitle).trim() !== '') {
                query = 'SELECT * FROM expedientes WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))';
                params = [String(rowTitle).trim()];
                matchType = `Título: ${rowTitle}`;
            } else if (rowMeta.valor1 && String(rowMeta.valor1).trim() !== '') {
                query = `SELECT * FROM expedientes WHERE (metadata_values::jsonb)->>'valor1' = $1 OR (metadata_values::jsonb)->>'Metadato 1' = $1`;
                params = [String(rowMeta.valor1).trim()];
                matchType = `Valor 1: ${rowMeta.valor1}`;
            }

            if (!query) {
                notFoundCount++;
                previewRows.push({
                    rowIndex: idx + 1,
                    status: 'not_found',
                    statusText: 'Sin datos clave para identificar el expediente (se requiere ID, Código o Título)',
                    matchType: 'N/A',
                    title: rowTitle || 'Sin Título',
                    expediente_code: rowCode || '',
                    changes: [],
                    original: null,
                    proposed: item
                });
                continue;
            }

            const dbRes = await client.query(query, params);
            if (dbRes.rowCount === 0) {
                notFoundCount++;
                previewRows.push({
                    rowIndex: idx + 1,
                    status: 'not_found',
                    statusText: `No encontrado en la base de datos (${matchType})`,
                    matchType,
                    title: rowTitle || 'Sin Título',
                    expediente_code: rowCode || '',
                    changes: [],
                    original: null,
                    proposed: item
                });
            } else if (dbRes.rowCount > 1) {
                ambiguousCount++;
                previewRows.push({
                    rowIndex: idx + 1,
                    status: 'ambiguous',
                    statusText: `Coincide con ${dbRes.rowCount} expedientes. Especifique el ID para desambiguar.`,
                    matchType,
                    title: rowTitle || dbRes.rows[0].title,
                    expediente_code: rowCode || dbRes.rows[0].expediente_code,
                    changes: [],
                    original: dbRes.rows[0],
                    proposed: item
                });
            } else {
                matchedCount++;
                const existing = dbRes.rows[0];
                let existingMeta = {};
                try {
                    existingMeta = typeof existing.metadata_values === 'string' 
                        ? JSON.parse(existing.metadata_values || '{}') 
                        : (existing.metadata_values || {});
                } catch (e) {
                    existingMeta = {};
                }

                const subLabels = trdLabelsMap[existing.subserie] || {};
                const getMetaLabel = (mKey) => {
                    const idxStr = mKey.replace('valor', '');
                    const custom = subLabels[`meta_${idxStr}`] || subLabels[mKey];
                    return custom ? `${custom} (Valor ${idxStr})` : `Metadato ${idxStr}`;
                };

                const changes = [];

                const checkDiff = (field, label, oldV, newV, isDate = false) => {
                    if (newV === undefined || newV === null) return;
                    const cleanNew = String(newV).trim();
                    if (cleanNew === '') return;

                    let oldStr = oldV !== undefined && oldV !== null ? String(oldV).trim() : '';
                    let newStr = cleanNew;

                    if (isDate) {
                        const parsedOld = normalizeDateVal(oldStr);
                        const parsedNew = normalizeDateVal(newStr);
                        if (parsedOld && parsedNew) {
                            if (parsedOld !== parsedNew) {
                                changes.push({ field, label, oldVal: parsedOld, newVal: parsedNew });
                            }
                            return;
                        }
                    }

                    if (oldStr !== newStr) {
                        changes.push({ field, label, oldVal: oldStr || '(Vacío)', newVal: newStr });
                    }
                };

                if (rowCode !== undefined) checkDiff('expediente_code', 'Código Expediente', existing.expediente_code, rowCode);
                if (rowTitle !== undefined) checkDiff('title', 'Título', existing.title, rowTitle);
                if (rowBox !== undefined) checkDiff('box_id', 'Caja', existing.box_id, rowBox);
                if (rowDate !== undefined) checkDiff('opening_date', 'Fecha Apertura', existing.opening_date, rowDate, true);
                if (rowSubserie !== undefined) checkDiff('subserie', 'Subserie TRD', existing.subserie, rowSubserie);
                if (rowStorage !== undefined) checkDiff('storage_type', 'Tipo Soporte', existing.storage_type, rowStorage);

                for (let m = 1; m <= 8; m++) {
                    const mKey = `valor${m}`;
                    if (rowMeta[mKey] !== undefined) {
                        checkDiff(mKey, getMetaLabel(mKey), existingMeta[mKey], rowMeta[mKey]);
                    }
                }

                if (changes.length > 0) {
                    withChangesCount++;
                    previewRows.push({
                        rowIndex: idx + 1,
                        id: existing.id,
                        status: 'changed',
                        statusText: `${changes.length} campo(s) a actualizar`,
                        matchType,
                        title: existing.title || rowTitle,
                        expediente_code: existing.expediente_code || rowCode,
                        changes,
                        original: existing,
                        proposed: item
                    });
                } else {
                    unchangedCount++;
                    previewRows.push({
                        rowIndex: idx + 1,
                        id: existing.id,
                        status: 'unchanged',
                        statusText: 'Sin cambios (datos idénticos)',
                        matchType,
                        title: existing.title,
                        expediente_code: existing.expediente_code,
                        changes: [],
                        original: existing,
                        proposed: item
                    });
                }
            }
        }

        res.json({
            summary: {
                total: rawRows.length,
                matched: matchedCount,
                withChanges: withChangesCount,
                unchanged: unchangedCount,
                notFound: notFoundCount,
                ambiguous: ambiguousCount
            },
            previewRows
        });

    } catch (err) {
        console.error('[EXPEDIENTES] Error en mass-update-preview:', err);
        res.status(500).json({ error: 'Error analizando datos en el servidor: ' + err.message });
    } finally {
        client.release();
    }
});

// POST mass update apply (Executes verified changes)
router.post('/mass-update-apply', async (req, res) => {
    const { updates, ignoreEmpty = true } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'No se enviaron registros para actualizar.' });
    }

    const client = await (db.pool || db).connect();
    try {
        await client.query('BEGIN');
        let updatedCount = 0;
        const errors = [];

        for (let i = 0; i < updates.length; i++) {
            const upd = updates[i];
            const { id, changes } = upd;

            if (!id || !changes || !Array.isArray(changes) || changes.length === 0) {
                continue;
            }

            try {
                const curRes = await client.query('SELECT * FROM expedientes WHERE id = $1', [id]);
                if (curRes.rowCount === 0) {
                    errors.push({ id, error: 'Expediente no encontrado en la base de datos' });
                    continue;
                }

                const current = curRes.rows[0];
                let currentMeta = {};
                try {
                    currentMeta = typeof current.metadata_values === 'string'
                        ? JSON.parse(current.metadata_values || '{}')
                        : (current.metadata_values || {});
                } catch (e) {
                    currentMeta = {};
                }

                let newCode = current.expediente_code;
                let newTitle = current.title;
                let newBox = current.box_id;
                let newDate = current.opening_date;
                let newSubserie = current.subserie;
                let newStorage = current.storage_type;

                changes.forEach(ch => {
                    const { field, newVal } = ch;
                    if (newVal === undefined || newVal === null) return;
                    if (ignoreEmpty && String(newVal).trim() === '') return;

                    if (field === 'expediente_code') newCode = String(newVal).trim();
                    else if (field === 'title') newTitle = String(newVal).trim();
                    else if (field === 'box_id') newBox = String(newVal).trim();
                    else if (field === 'opening_date') newDate = normalizeDateVal(newVal);
                    else if (field === 'subserie') newSubserie = String(newVal).trim();
                    else if (field === 'storage_type') newStorage = String(newVal).trim();
                    else if (field.startsWith('valor')) {
                        currentMeta[field] = String(newVal).trim();
                    }
                });

                const cleanedMeta = correctMetadata(currentMeta);

                await client.query(`
                    UPDATE expedientes SET
                        expediente_code = $1,
                        title = $2,
                        box_id = $3,
                        opening_date = $4,
                        subserie = $5,
                        storage_type = $6,
                        metadata_values = $7
                    WHERE id = $8
                `, [newCode, newTitle, newBox, newDate, newSubserie, newStorage, JSON.stringify(cleanedMeta), id]);

                updatedCount++;
            } catch (itemErr) {
                console.error(`[EXPEDIENTES] Error actualizando expediente ID ${id}:`, itemErr);
                errors.push({ id, error: itemErr.message });
            }
        }

        await client.query('COMMIT');
        console.log(`[EXPEDIENTES] Actualización masiva completada: ${updatedCount} actualizados, ${errors.length} errores.`);
        res.json({
            success: true,
            message: `Actualización masiva completada con éxito. ${updatedCount} expedientes actualizados.`,
            updatedCount,
            errors
        });

    } catch (fatalErr) {
        await client.query('ROLLBACK');
        console.error('[EXPEDIENTES] Error fatal en mass-update-apply:', fatalErr);
        res.status(500).json({ error: 'Fallo crítico al actualizar en base de datos: ' + fatalErr.message });
    } finally {
        client.release();
    }
});

// PUT update expediente
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { 
        expediente_code, box_id, opening_date, subserie, 
        regional, centro, dependencia,
        storage_type, title, metadata_values 
    } = req.body;
    
    // Get current record to merge if partial update
    db.get("SELECT * FROM expedientes WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Expediente no encontrado' });

        const query = `
            UPDATE expedientes 
            SET expediente_code = ?, box_id = ?, opening_date = ?, subserie = ?, 
                regional = ?, centro = ?, dependencia = ?,
                storage_type = ?, title = ?, metadata_values = ?
            WHERE id = ?
        `;
        const params = [
            expediente_code !== undefined ? expediente_code : row.expediente_code,
            box_id !== undefined ? box_id : row.box_id,
            opening_date !== undefined ? opening_date : row.opening_date,
            subserie !== undefined ? subserie : row.subserie,
            regional !== undefined ? regional : row.regional,
            centro !== undefined ? centro : row.centro,
            dependencia !== undefined ? dependencia : row.dependencia,
            storage_type !== undefined ? storage_type : row.storage_type,
            title !== undefined ? title : row.title,
            metadata_values !== undefined ? JSON.stringify(correctMetadata(metadata_values)) : row.metadata_values,
            id
        ];

        db.run(query, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Expediente actualizado correctamente' });
        });
    });
});

// DELETE expediente
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Opcional: Verificar permisos si no es admin
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const checkQ = `
            SELECT 1 FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series s ON (e.subserie = s.series_code OR e.subserie LIKE '%-' || s.series_code OR sub.series_id = s.id)
            JOIN user_trd_permissions p ON p.user_id = ? AND p.can_edit = 1 AND (p.series_id = s.id OR p.subseries_id = sub.id)
            WHERE e.id = ?
        `;
        db.get(checkQ, [req.user.id, id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos' });
            if (!row) return res.status(403).json({ error: 'No tiene permisos para eliminar este expediente' });
            
            db.run("DELETE FROM expedientes WHERE id = ?", [id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Expediente eliminado correctamente' });
            });
        });
        return;
    }

    db.run("DELETE FROM expedientes WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Expediente no encontrado' });
        res.json({ success: true, message: 'Expediente eliminado correctamente' });
    });
});

// GET run-deduplicate manually
router.get('/run-deduplicate', async (req, res) => {
    // Only allow admin or superadmin
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { pool } = require('../database_pg');
    try {
        console.log('[MANUAL MIGRATION] Running deduplicate...');
        const queryRes = await pool.query('SELECT id, expediente_code, title, subserie, box_id, metadata_values FROM expedientes');
        const list = queryRes.rows;
        
        const groups = {};
        for (const row of list) {
            let key = '';
            if (row.expediente_code && row.expediente_code.trim() !== '') {
                key = `code:${row.expediente_code.trim()}`;
            } else {
                let metaStr = '';
                if (row.metadata_values) {
                    try {
                        const mObj = typeof row.metadata_values === 'string' ? JSON.parse(row.metadata_values) : row.metadata_values;
                        metaStr = Object.keys(mObj).sort().map(k => `${k}:${mObj[k]}`).join('|');
                    } catch (e) {
                        metaStr = String(row.metadata_values);
                    }
                }
                key = `meta:${(row.title || '').trim().toLowerCase()}|${(row.subserie || '').trim()}|${(row.box_id || '').trim()}|${metaStr}`;
            }
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }
        
        let totalDeduplicated = 0;
        const log = [];
        
        for (const key of Object.keys(groups)) {
            const group = groups[key];
            if (group.length > 1) {
                group.sort((a, b) => a.id - b.id);
                const primaryId = group[0].id;
                const duplicateIds = group.slice(1).map(r => r.id);
                
                log.push(`Grupo duplicado. Primario: ${primaryId}. Duplicados: ${duplicateIds.join(', ')}`);
                
                // 1. Move documents
                const docRes = await pool.query(
                    'UPDATE documents SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );
                log.push(`  Movidos ${docRes.rowCount} documentos al primario ${primaryId}`);
                
                // 2. Move assignments (delete duplicates, update others)
                const delAssignDup = await pool.query(`
                    DELETE FROM expediente_assignments
                    WHERE expediente_id = ANY($1::int[])
                      AND user_id IN (
                          SELECT user_id FROM expediente_assignments WHERE expediente_id = $2
                      )
                `, [duplicateIds, primaryId]);
                log.push(`  Eliminadas ${delAssignDup.rowCount} asignaciones que causarían conflicto`);

                const updAssign = await pool.query(
                    'UPDATE expediente_assignments SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );
                log.push(`  Movidas ${updAssign.rowCount} asignaciones al primario ${primaryId}`);

                // 3. Move package items (delete duplicates, update others)
                const delPkgDup = await pool.query(`
                    DELETE FROM paquete_items 
                    WHERE expediente_id = ANY($1::int[])
                      AND paquete_id IN (
                          SELECT paquete_id FROM paquete_items WHERE expediente_id = $2
                      )
                `, [duplicateIds, primaryId]);
                log.push(`  Eliminados ${delPkgDup.rowCount} items de paquetes que causarían conflicto`);

                const updPkg = await pool.query(
                    'UPDATE paquete_items SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );
                log.push(`  Movidos ${updPkg.rowCount} items de paquetes al primario ${primaryId}`);
                
                // 4. Delete duplicate expedientes
                const delRes = await pool.query(
                    'DELETE FROM expedientes WHERE id = ANY($1::int[])',
                    [duplicateIds]
                );
                log.push(`  Eliminados ${delRes.rowCount} expedientes duplicados de la tabla expedientes`);
                
                totalDeduplicated += delRes.rowCount;
            }
        }
        
        res.json({
            success: true,
            totalDeduplicated,
            log
        });
    } catch (err) {
        console.error('[MANUAL MIGRATION] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// Automatic Migration: Deduplicate expedientes table on startup
// ──────────────────────────────────────────────────────────────
(async () => {
    // Wait slightly for database pool initialization
    await new Promise(r => setTimeout(r, 2000));
    const { pool } = require('../database_pg');
    
    try {
        console.log('[MIGRATION] Checking for duplicate records in expedientes...');
        
        // Find duplicate groups of expedientes
        const res = await pool.query('SELECT id, expediente_code, title, subserie, box_id, metadata_values FROM expedientes');
        const list = res.rows;
        
        const groups = {};
        for (const row of list) {
            let key = '';
            if (row.expediente_code && row.expediente_code.trim() !== '') {
                key = `code:${row.expediente_code.trim()}`;
            } else {
                // Include custom metadata values to distinguish different individuals
                let metaStr = '';
                if (row.metadata_values) {
                    try {
                        const mObj = typeof row.metadata_values === 'string' ? JSON.parse(row.metadata_values) : row.metadata_values;
                        metaStr = Object.keys(mObj).sort().map(k => `${k}:${mObj[k]}`).join('|');
                    } catch (e) {
                        metaStr = String(row.metadata_values);
                    }
                }
                key = `meta:${(row.title || '').trim().toLowerCase()}|${(row.subserie || '').trim()}|${(row.box_id || '').trim()}|${metaStr}`;
            }
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }
        
        let totalDeduplicated = 0;
        
        for (const key of Object.keys(groups)) {
            const group = groups[key];
            if (group.length > 1) {
                // Sort by ID to ensure we keep the oldest one (smallest ID)
                group.sort((a, b) => a.id - b.id);
                
                const primaryId = group[0].id;
                const duplicateIds = group.slice(1).map(r => r.id);
                
                console.log(`[MIGRATION] Duplicate group found. Primary ID: ${primaryId}. Duplicate IDs: ${duplicateIds.join(', ')}`);
                
                // 1. Move documents from duplicate expedientes to the primary one
                await pool.query(
                    'UPDATE documents SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );
                
                // 2. Move assignments from duplicate expedientes to the primary one
                await pool.query(`
                    DELETE FROM expediente_assignments
                    WHERE expediente_id = ANY($1::int[])
                      AND user_id IN (
                          SELECT user_id FROM expediente_assignments WHERE expediente_id = $2
                      )
                `, [duplicateIds, primaryId]);
                await pool.query(
                    'UPDATE expediente_assignments SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );

                // 3. Move items in packages (paquete_items)
                await pool.query(`
                    DELETE FROM paquete_items 
                    WHERE expediente_id = ANY($1::int[])
                      AND paquete_id IN (
                          SELECT paquete_id FROM paquete_items WHERE expediente_id = $2
                      )
                `, [duplicateIds, primaryId]);
                await pool.query(
                    'UPDATE paquete_items SET expediente_id = $1 WHERE expediente_id = ANY($2::int[])',
                    [primaryId, duplicateIds]
                );
                
                // 4. Finally delete the duplicate expedientes themselves
                const delRes = await pool.query(
                    'DELETE FROM expedientes WHERE id = ANY($1::int[])',
                    [duplicateIds]
                );
                
                totalDeduplicated += delRes.rowCount;
            }
        }
        
        if (totalDeduplicated > 0) {
            console.log(`[MIGRATION] Deduplication completed. Cleaned up ${totalDeduplicated} duplicate expedientes.`);
        } else {
            console.log('[MIGRATION] No duplicate expedientes found.');
        }
    } catch (err) {
        console.error('[MIGRATION] Error during duplicate expedientes cleanup:', err.message);
    }
})();

module.exports = router;
