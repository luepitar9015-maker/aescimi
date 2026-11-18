const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const BASE_USER_MODULES = ['dashboard', 'documents', 'clasificacion-masiva', 'query'];
const ASSIGNABLE_USER_MODULES = ['dashboard', 'documents', 'clasificacion-masiva', 'query', 'historias-academicas', 'seguimiento', 'formatos', 'trd_query'];
const ALL_KNOWN_MODULES = [
    'dashboard', 'trd', 'expedientes', 'documents', 'clasificacion-masiva', 'query',
    'historias-academicas', 'mass-upload', 'cargue-aes', 'letters', 'onedrive', 'config-aes',
    'automation', 'users', 'permissions', 'trd_query', 'formatos',
    'deserciones', 'seguimiento', 'comunicaciones-producidas'
];

let permsSchemaPromise = null;
function ensurePermissionsTables() {
    if (permsSchemaPromise) return permsSchemaPromise;
    permsSchemaPromise = (async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_module_permissions (
                    user_id INTEGER NOT NULL,
                    module_id TEXT NOT NULL,
                    can_view INTEGER DEFAULT 1,
                    assigned_by INTEGER,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, module_id)
                )
            `);
            for (const mod of BASE_USER_MODULES) {
                await pool.query(
                    `INSERT INTO role_permissions (role_name, module_id, can_view)
                     VALUES ('user', $1, 1)
                     ON CONFLICT (role_name, module_id) DO NOTHING`,
                    [mod]
                );
            }
            await pool.query(
                `INSERT INTO role_permissions (role_name, module_id, can_view)
                 VALUES ('admin', 'historias-academicas', 1)
                 ON CONFLICT (role_name, module_id) DO UPDATE SET can_view = 1`
            );
        } catch (e) {
            console.error('[PERMISSIONS] Error ensuring user_module_permissions:', e.message);
        }
    })();
    return permsSchemaPromise;
}

ensurePermissionsTables();

// Get all role permissions (Admin)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensurePermissionsTables();
        const result = await pool.query('SELECT role_name, module_id, can_view FROM role_permissions');
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get per-user module assignments (Admin - especially for Coordinaciones)
router.get('/user-modules/list', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensurePermissionsTables();
        const usersRes = await pool.query(`
            SELECT u.id, u.full_name, u.document_no, u.area, u.position, u.role, u.organization_id,
                   o.subsection_code, o.subsection_name, o.section_name,
                   COALESCE((
                       SELECT json_object_agg(ump.module_id, ump.can_view)
                       FROM user_module_permissions ump
                       WHERE ump.user_id = u.id
                   ), '{}'::json) AS user_modules
            FROM users u
            LEFT JOIN organization_structure o ON o.id = u.organization_id
            WHERE u.is_active = 1 AND u.role != 'superadmin'
            ORDER BY
                CASE WHEN u.organization_id IN (8, 7) THEN 0 ELSE 1 END,
                u.organization_id DESC NULLS LAST,
                u.full_name ASC
        `);
        res.json({ success: true, data: usersRes.rows });
    } catch (err) {
        console.error('Error fetching user module permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Assign or revoke a module for one or multiple users (e.g. Coordinaciones -> historias-academicas)
router.post('/user-modules/assign', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensurePermissionsTables();
        const { user_ids, user_id, module_id = 'historias-academicas', can_view = 1 } = req.body || {};
        const ids = Array.isArray(user_ids)
            ? user_ids.map(Number).filter(Boolean)
            : (user_id ? [Number(user_id)] : []);

        if (ids.length === 0) {
            return res.status(400).json({ error: 'Seleccione al menos un usuario.' });
        }

        const effectiveVal = Number(can_view) === 1 ? 1 : 0;
        for (const uid of ids) {
            await pool.query(
                `INSERT INTO user_module_permissions (user_id, module_id, can_view, assigned_by, updated_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id, module_id)
                 DO UPDATE SET can_view = EXCLUDED.can_view, assigned_by = EXCLUDED.assigned_by, updated_at = CURRENT_TIMESTAMP`,
                [uid, module_id, effectiveVal, req.user?.id || null]
            );
        }
        res.json({
            success: true,
            updated: ids.length,
            module_id,
            can_view: effectiveVal
        });
    } catch (err) {
        console.error('Error assigning user module:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get effective permissions for current user / role (merges role_permissions + user_module_permissions)
router.get('/:role', requireAuth, async (req, res) => {
    try {
        await ensurePermissionsTables();
        const role = req.params.role;
        if (role === 'admin' || role === 'superadmin') {
            const result = await pool.query(
                'SELECT module_id, can_view FROM role_permissions WHERE role_name = $1',
                [role]
            );
            const map = new Map();
            ALL_KNOWN_MODULES.forEach(m => map.set(m, 1));
            (result.rows || []).forEach(r => map.set(r.module_id, Number(r.can_view)));
            map.set('historias-academicas', 1);
            return res.json({
                data: Array.from(map.entries()).map(([module_id, can_view]) => ({ module_id, can_view }))
            });
        }

        // Standard 'user' role: merge role_permissions (for assignable modules) + per-user overrides
        const roleRes = await pool.query(
            `SELECT module_id, can_view FROM role_permissions WHERE role_name = 'user'`
        );
        const roleMap = new Map();
        BASE_USER_MODULES.forEach(m => roleMap.set(m, 1));
        (roleRes.rows || []).forEach(r => {
            if (ASSIGNABLE_USER_MODULES.includes(r.module_id)) {
                roleMap.set(r.module_id, Number(r.can_view));
            }
        });

        const userMap = new Map();
        if (req.user && req.user.id) {
            const uRes = await pool.query(
                `SELECT module_id, can_view FROM user_module_permissions WHERE user_id = $1`,
                [req.user.id]
            );
            (uRes.rows || []).forEach(r => {
                userMap.set(r.module_id, Number(r.can_view));
            });
        }

        return res.json({
            data: ALL_KNOWN_MODULES.map(m => {
                let allowed = 0;
                if (userMap.has(m)) {
                    allowed = userMap.get(m);
                } else if (roleMap.has(m)) {
                    allowed = roleMap.get(m);
                }
                if (!ASSIGNABLE_USER_MODULES.includes(m)) {
                    allowed = 0;
                }
                return { module_id: m, can_view: allowed ? 1 : 0 };
            })
        });
    } catch (err) {
        console.error('Error fetching role permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update a specific role permission (Upsert)
router.post('/update', requireAuth, requireAdmin, async (req, res) => {
    const { role, module_id, can_view } = req.body;
    try {
        await ensurePermissionsTables();
        const effectiveCanView = (role === 'user' && !ASSIGNABLE_USER_MODULES.includes(module_id))
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
        await ensurePermissionsTables();
        await pool.query('DELETE FROM role_permissions WHERE role_name = $1', [role]);
        if (role === 'user') {
            for (const mod of BASE_USER_MODULES) {
                await pool.query(
                    `INSERT INTO role_permissions (role_name, module_id, can_view)
                     VALUES ('user', $1, 1)
                     ON CONFLICT (role_name, module_id) DO UPDATE SET can_view = 1`,
                    [mod]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error resetting permissions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
