const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const { requireAuth } = require('../middleware/authMiddleware');

// Get documents for ADES load — acepta ?status=Pendiente|Cargado|Todos (default: Pendiente)
router.get('/pending', requireAuth, (req, res) => {
    const { status } = req.query;
    const activeStatus = status || 'Pendiente';
    let whereClause = activeStatus === 'Todos'
        ? 'WHERE 1=1'
        : `WHERE d.status = '${activeStatus}'`;

    const params = [];
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        whereClause += ` AND d.organization_id = ? 
                         AND (d.trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR d.trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
        params.push(req.user.organization_id || 0, req.user.id, req.user.id);
    }
    const query = `
        SELECT 
            d.*, 
            d.storage_path,
            e.expediente_code, 
            e.title, 
            e.metadata_values as expediente_metadata,
            e.box_id,
            e.opening_date,
            e.subserie,
            e.storage_type,
            COALESCE(t_min.min_id, 9999) as typology_order
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN (
            SELECT typology_name, MIN(id) as min_id
            FROM trd_typologies
            GROUP BY typology_name
        ) t_min ON d.typology_name = t_min.typology_name
        ${whereClause}
        ORDER BY ${activeStatus === 'Cargado' ? 'd.load_date DESC,' : ''} typology_order ASC, d.created_at ASC
        LIMIT 300
    `;
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(row => {
            let docMeta = {};
            let expMeta = {};
            try { if (row.metadata_values) docMeta = JSON.parse(row.metadata_values); } catch (e) {}
            try { if (row.expediente_metadata) expMeta = JSON.parse(row.expediente_metadata); } catch (e) {}
            return {
                ...row,
                document_metadata: docMeta && typeof docMeta === 'object' ? docMeta : {},
                expediente_metadata: expMeta && typeof expMeta === 'object' ? expMeta : {}
            };
        });
        res.json(processed);
    });
});


// Get ALL documents with optional status filter (?status=Pendiente|Cargado|Todos)
router.get('/all', requireAuth, (req, res) => {
    const { status } = req.query; // 'Pendiente', 'Cargado', o vacío/Todos
    let whereClause = status && status !== 'Todos' ? `WHERE d.status = '${status}'` : 'WHERE 1=1';

    const params = [];
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        whereClause += ` AND d.organization_id = ? 
                         AND (d.trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR d.trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
        params.push(req.user.organization_id || 0, req.user.id, req.user.id);
    }

    const query = `
        SELECT 
            d.*, 
            e.expediente_code, 
            e.title, 
            e.metadata_values as expediente_metadata,
            e.box_id,
            e.opening_date,
            e.subserie,
            e.storage_type,
            COALESCE(t_min.min_id, 9999) as typology_order
        FROM documents d
        JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN (
            SELECT typology_name, MIN(id) as min_id
            FROM trd_typologies
            GROUP BY typology_name
        ) t_min ON d.typology_name = t_min.typology_name
        ${whereClause}
        ORDER BY d.load_date DESC, typology_order ASC, d.created_at ASC
        LIMIT 200
    `;
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(row => {
            let docMeta = {};
            let expMeta = {};
            try { if (row.metadata_values) docMeta = JSON.parse(row.metadata_values); } catch (e) {}
            try { if (row.expediente_metadata) expMeta = JSON.parse(row.expediente_metadata); } catch (e) {}
            return {
                ...row,
                document_metadata: docMeta && typeof docMeta === 'object' ? docMeta : {},
                expediente_metadata: expMeta && typeof expMeta === 'object' ? expMeta : {}
            };
        });
        res.json(processed);
    });
});


// Update document status after ADES load
router.post('/update-status', (req, res) => {
    const { id, status, ades_id } = req.body;
    const load_date = status === 'Cargado' ? new Date().toISOString() : null;

    const query = `
        UPDATE documents 
        SET status = ?, ades_id = ?, load_date = ?
        WHERE id = ?
    `;
    db.run(query, [status, ades_id || null, load_date, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Document status updated', id });
    });
});

// Serve document file content
router.get('/view/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT path, filename FROM documents WHERE id = ?", [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Documento no encontrado' });

        if (!fs.existsSync(doc.path)) {
            console.error(`[VIEW] Archivo no encontrado en disco: ${doc.path}`);
            return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
        fs.createReadStream(doc.path).pipe(res);
    });
});

module.exports = router;
