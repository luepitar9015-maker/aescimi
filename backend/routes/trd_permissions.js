const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');

// GET permissions for a user
router.get('/user/:userId', (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT p.*, s.series_name, sub.subseries_name 
        FROM user_trd_permissions p
        LEFT JOIN trd_series s ON p.series_id = s.id
        LEFT JOIN trd_subseries sub ON p.subseries_id = sub.id
        WHERE p.user_id = $1
    `;
    pool.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: result.rows });
    });
});

// POST add/update permission
router.post('/', (req, res) => {
    const { user_id, series_id, subseries_id, can_view, can_upload } = req.body;
    
    const query = `
        INSERT INTO user_trd_permissions (user_id, series_id, subseries_id, can_view, can_upload)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, series_id, subseries_id)
        DO UPDATE SET can_view = EXCLUDED.can_view, can_upload = EXCLUDED.can_upload
    `;
    
    pool.query(query, [user_id, series_id || null, subseries_id || null, can_view ? 1 : 0, can_upload ? 1 : 0], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Permisos granulares actualizados" });
    });
});

// DELETE permission
router.delete('/:id', (req, res) => {
    pool.query("DELETE FROM user_trd_permissions WHERE id = $1", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Permiso granular eliminado" });
    });
});

module.exports = router;
