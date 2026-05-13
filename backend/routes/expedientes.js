const express = require('express');
const router = express.Router();
const db = require('../database');
const xlsx = require('xlsx');

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
        'Valor 1', 'Valor 2', 'Valor 3', 'Valor 4',
        'Valor 5', 'Valor 6', 'Valor 7', 'Valor 8'
    ];
    
    // Example data
    const examples = [
        ['EXP-2026-001', 'CAJA-01', '2026-01-15', '200.1.01', 'Fisico', 'Expediente de Prueba 1', 'Meta 1', 'Meta 2', '', '', '', '', '', ''],
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, ...examples]);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
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
                    metadata_values: row.metadata_values ? JSON.parse(row.metadata_values) : {},
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
            metadata_values: row.metadata_values ? JSON.parse(row.metadata_values) : {},
            metadata_labels: row.sub_labels ? JSON.parse(row.sub_labels) : (row.series_labels ? JSON.parse(row.series_labels) : null)
        }));
        res.json({ data: processed });
    });
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
                    metadata_values: row.metadata_values ? JSON.parse(row.metadata_values) : {}
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
            metadata_values: row.metadata_values ? JSON.parse(row.metadata_values) : {}
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
        
        row.metadata_values = row.metadata_values ? JSON.parse(row.metadata_values) : {};
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
        JSON.stringify(metadata_values || {})
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
    const expedientes = req.body; // Array of objects

    if (!Array.isArray(expedientes) || expedientes.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
    }

    console.log(`[EXPEDIENTES] Recibida solicitud masiva con ${expedientes.length} registros.`);

    const { pool } = require('../database_pg');
    const client = await pool.connect();
    const errors = [];
    const created_ids = [];
    let created = 0;

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
                JSON.stringify(exp.metadata_values || {})
            ];

            const savepointName = `sp_exp_${i}`;
            try {
                await client.query(`SAVEPOINT ${savepointName}`);
                const result = await client.query(
                    `INSERT INTO expedientes 
                     (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                    params
                );
                await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                created++;
                if (result.rows[0]) created_ids.push(result.rows[0].id);
            } catch (err) {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                const errMsg = err.detail || err.message;
                console.error(`[EXPEDIENTES] Error insertando "${exp.expediente_code || exp.title}": ${errMsg}`);
                errors.push({ expediente: exp.expediente_code || exp.title || `Fila ${i + 1}`, error: errMsg });
            }
        }

        await client.query('COMMIT');
        console.log(`[EXPEDIENTES] Completado. ${created} creados, ${errors.length} fallidos.`);
        res.json({
            message: `Procesado. ${created} creados, ${errors.length} fallidos.`,
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

// POST mass update expedientes (By Title/Metadata)
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

        // Buscar el expediente existente basado en Titulo o Valores
        // Prioridad: 1. Titulo exacto, 2. Valor 1 exacto
        let q = `SELECT id, expediente_code FROM expedientes WHERE title = $1`;
        let p = [titleQuery];

        if (!titleQuery && val1Query) {
            // Usa el operador PostgreSQL ->> ya que la BD real es PostgreSQL.
            // Extra: usa CAST por si la columna metadata_values se guarda como texto plano en lugar de jsonb
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
            
            // Actualizar el código
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
            metadata_values !== undefined ? JSON.stringify(metadata_values) : row.metadata_values,
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

module.exports = router;
