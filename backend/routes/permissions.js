const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Get all permissions
router.get('/', requireAuth, requireAdmin, (req, res) => {
    db.all("SELECT role_name, module_id, can_view FROM role_permissions", [], (err, rows) => {
        if (err) {
            console.error('Error fetching permissions:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ data: rows });
    });
});

// Update a specific permission (Upsert)
router.post('/update', requireAuth, requireAdmin, (req, res) => {
    const { role, module_id, can_view } = req.body;

    const sql = `
        INSERT INTO role_permissions (role_name, module_id, can_view) 
        VALUES (?, ?, ?)
        ON CONFLICT(role_name, module_id) DO UPDATE SET can_view = EXCLUDED.can_view
    `;

    db.run(sql, [role, module_id, can_view], function (err) {
        if (err) {
            console.error('Error updating permission:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Reset permissions for a role
router.post('/reset', requireAuth, requireAdmin, (req, res) => {
    const { role } = req.body;

    db.run("DELETE FROM role_permissions WHERE role_name = ?", [role], function (err) {
        if (err) {
            console.error('Error resetting permissions:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, changes: this.changes });
    });
});

module.exports = router;
