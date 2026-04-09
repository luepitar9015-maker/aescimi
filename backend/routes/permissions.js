const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Get all permissions
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT role_name, module_id, can_view FROM role_permissions');
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get permissions for a specific role (e.g. /api/permissions/superadmin)
router.get('/:role', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT module_id, can_view FROM role_permissions WHERE role_name = $1',
            [req.params.role]
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching role permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update a specific permission (Upsert)
router.post('/update', requireAuth, requireAdmin, async (req, res) => {
    const { role, module_id, can_view } = req.body;
    try {
        await pool.query(
            `INSERT INTO role_permissions (role_name, module_id, can_view) 
             VALUES ($1, $2, $3)
             ON CONFLICT(role_name, module_id) DO UPDATE SET can_view = EXCLUDED.can_view`,
            [role, module_id, can_view]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating permission:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Reset permissions for a role
router.post('/reset', requireAuth, requireAdmin, async (req, res) => {
    const { role } = req.body;
    try {
        const result = await pool.query(
            'DELETE FROM role_permissions WHERE role_name = $1',
            [role]
        );
        res.json({ success: true, changes: result.rowCount });
    } catch (err) {
        console.error('Error resetting permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
