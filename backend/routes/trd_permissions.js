const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');

// GET permissions for a user
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT p.*, s.series_name, s.series_code, sub.subseries_name, sub.subseries_code
        FROM user_trd_permissions p
        LEFT JOIN trd_series s ON p.series_id = s.id
        LEFT JOIN trd_subseries sub ON p.subseries_id = sub.id
        WHERE p.user_id = $1
        ORDER BY p.id ASC
    `;
    try {
        const result = await pool.query(query, [userId]);
        const rows = result.rows.map(r => {
            let parsedStages = null;
            if (r.allowed_stages) {
                try { parsedStages = JSON.parse(r.allowed_stages); } catch { parsedStages = [r.allowed_stages]; }
            }
            return { ...r, allowed_stages: parsedStages };
        });
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add/update permission
router.post('/', async (req, res) => {
    const { user_id, series_id, subseries_id, can_view, can_upload, allowed_stages } = req.body;
    const stagesJson = Array.isArray(allowed_stages) && allowed_stages.length > 0
        ? JSON.stringify(allowed_stages)
        : null;
    
    const query = `
        INSERT INTO user_trd_permissions (user_id, series_id, subseries_id, can_view, can_upload, allowed_stages)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, series_id, subseries_id)
        DO UPDATE SET can_view = EXCLUDED.can_view, can_upload = EXCLUDED.can_upload, allowed_stages = EXCLUDED.allowed_stages
    `;
    
    try {
        await pool.query(query, [
            user_id,
            series_id || null,
            subseries_id || null,
            can_view ? 1 : 0,
            can_upload ? 1 : 0,
            stagesJson
        ]);
        res.json({ message: "Permisos granulares actualizados" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update stages or flags for a permission by id
router.put('/:id', async (req, res) => {
    const { allowed_stages, can_view, can_upload } = req.body;
    const stagesJson = Array.isArray(allowed_stages) && allowed_stages.length > 0
        ? JSON.stringify(allowed_stages)
        : null;
    try {
        await pool.query(
            `UPDATE user_trd_permissions 
             SET allowed_stages = $1,
                 can_view = COALESCE($2, can_view),
                 can_upload = COALESCE($3, can_upload)
             WHERE id = $4`,
            [
                stagesJson,
                can_view !== undefined ? (can_view ? 1 : 0) : null,
                can_upload !== undefined ? (can_upload ? 1 : 0) : null,
                req.params.id
            ]
        );
        res.json({ message: "Etapas del permiso actualizadas" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE permission
router.delete('/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM user_trd_permissions WHERE id = $1", [req.params.id]);
        res.json({ message: "Permiso granular eliminado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
