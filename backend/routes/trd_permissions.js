const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');

// GET permissions for a user
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT p.*, s.series_name, sub.subseries_name 
        FROM user_trd_permissions p
        LEFT JOIN trd_series s ON p.series_id = s.id
        LEFT JOIN trd_subseries sub ON p.subseries_id = sub.id
        WHERE p.user_id = $1
    `;
    try {
        const result = await pool.query(query, [userId]);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add/update permission
router.post('/', async (req, res) => {
    const { user_id, series_id, subseries_id, can_view, can_upload } = req.body;
    
    const query = `
        INSERT INTO user_trd_permissions (user_id, series_id, subseries_id, can_view, can_upload)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, series_id, subseries_id)
        DO UPDATE SET can_view = EXCLUDED.can_view, can_upload = EXCLUDED.can_upload
    `;
    
    try {
        await pool.query(query, [
            user_id,
            series_id || null,
            subseries_id || null,
            can_view ? 1 : 0,
            can_upload ? 1 : 0
        ]);
        res.json({ message: "Permisos granulares actualizados" });
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
