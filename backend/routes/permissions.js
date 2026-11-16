const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const ALLOWED_USER_MODULES = ['dashboard', 'documents', 'clasificacion-masiva', 'query'];
const ALL_KNOWN_MODULES = [
    'dashboard', 'trd', 'expedientes', 'documents', 'clasificacion-masiva', 'query',
    'mass-upload', 'cargue-aes', 'letters', 'onedrive', 'config-aes',
    'automation', 'users', 'permissions', 'trd_query', 'formatos',
    'deserciones', 'seguimiento', 'comunicaciones-producidas'
];

async function enforceUserPermissionsInDb() {
    try {
        await pool.query(
            `UPDATE role_permissions
             SET can_view = CASE WHEN module_id IN ('dashboard', 'documents', 'clasificacion-masiva', 'query') THEN 1 ELSE 0 END
             WHERE role_name = 'user'`
        );
        for (const mod of ALLOWED_USER_MODULES) {
            await pool.query(
                `INSERT INTO role_permissions (role_name, module_id, can_view)
                 VALUES ('user', $1, 1)
                 ON CONFLICT (role_name, module_id) DO UPDATE SET can_view = 1`,
                [mod]
            );
        }
    } catch (e) {
        console.error('[PERMISSIONS] Error enforcing user permissions:', e.message);
    }
}

// Enforce on module load
enforceUserPermissionsInDb();

// Get all permissions
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        await enforceUserPermissionsInDb();
        const result = await pool.query('SELECT role_name, module_id, can_view FROM role_permissions');
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get permissions for a specific role (e.g. /api/permissions/user)
router.get('/:role', requireAuth, async (req, res) => {
    try {
        const role = req.params.role;
        if (role !== 'admin' && role !== 'superadmin') {
            return res.json({
                data: ALL_KNOWN_MODULES.map(m => ({
                    module_id: m,
                    can_view: ALLOWED_USER_MODULES.includes(m) ? 1 : 0
                }))
            });
        }
        const result = await pool.query(
            'SELECT module_id, can_view FROM role_permissions WHERE role_name = $1',
            [role]
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
        const effectiveCanView = (role === 'user' && !ALLOWED_USER_MODULES.includes(module_id))
            ? 0
            : Number(can_view);
        await pool.query(
            `INSERT INTO role_permissions (role_name, module_id, can_view) 
             VALUES ($1, $2, $3)
             ON CONFLICT(role_name, module_id) DO UPDATE SET can_view = EXCLUDED.can_view`,
            [role, module_id, effectiveCanView]
        );
        res.json({ success: true, can_view: effectiveCanView });
    } catch (err) {
        console.error('Error updating permission:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Reset permissions for a role
router.post('/reset', requireAuth, requireAdmin, async (req, res) => {
    const { role } = req.body;
    try {
        await pool.query(
            'DELETE FROM role_permissions WHERE role_name = $1',
            [role]
        );
        if (role === 'user') {
            await enforceUserPermissionsInDb();
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error resetting permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
