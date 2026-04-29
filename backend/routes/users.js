const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { pool } = require('../database_pg');

// Change own password (for must_change_password flow)
router.post('/change-password', requireAuth, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        // Reseteamos el flag must_change_password a 0
        await pool.query('UPDATE users SET password_hash=$1, must_change_password=0 WHERE id=$2', [hash, req.user.id]);
        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        console.error('[USERS] CHANGE PASSWORD error:', err);
        res.status(500).json({ error: 'Error al actualizar contraseña.' });
    }
});

// List all users
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, full_name, area, position, document_no, email, role, organization_id, is_active FROM users ORDER BY id'
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[USERS] GET error:', err);
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
});

// Create a new user (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    const { full_name, area, position, document_no, password, email, role, organization_id } = req.body;

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'No tiene permiso para crear usuarios superadmin.' });
    }

    try {
        const passwordToHash = password || document_no;
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(passwordToHash, salt);

        const result = await pool.query(
            'INSERT INTO users (full_name, area, position, document_no, password_hash, email, role, organization_id, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
            [full_name, area, position, document_no, hash, email, role || 'user', organization_id || null, 1]
        );

        res.json({
            message: 'Usuario creado exitosamente',
            data: { id: result.rows[0].id, full_name, area, position, document_no, email, role: role || 'user', organization_id },
            id: result.rows[0].id
        });
    } catch (err) {
        console.error('[USERS] POST error:', err);
        res.status(400).json({ error: 'Error al crear usuario. Es posible que el número de documento ya exista.' });
    }
});

// Update a user (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    const { full_name, area, position, document_no, email, role, organization_id } = req.body;

    if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'No tiene permiso para asignar el rol superadmin.' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET full_name=$1, area=$2, position=$3, document_no=$4, email=$5, role=$6, organization_id=$7 WHERE id=$8',
            [full_name, area, position, document_no, email, role, organization_id || null, req.params.id]
        );
        res.json({ message: 'Usuario actualizado', changes: result.rowCount });
    } catch (err) {
        console.error('[USERS] PUT error:', err);
        res.status(400).json({ error: 'Error al actualizar usuario.' });
    }
});

// Delete a user (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'No puede eliminar su propia cuenta.' });
    }

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json({ message: 'Usuario eliminado', changes: result.rowCount });
    } catch (err) {
        console.error('[USERS] DELETE error:', err);
        res.status(400).json({ error: 'Error al eliminar usuario: ' + err.message });
    }
});

// Reset Password (admin only)
router.put('/:id/password', requireAuth, requireAdmin, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const result = await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
        res.json({ message: 'Contraseña actualizada', changes: result.rowCount });
    } catch (err) {
        console.error('[USERS] PASSWORD error:', err);
        res.status(400).json({ error: 'Error al actualizar contraseña.' });
    }
});

// ─── Mass Create Users from Excel ─────────────────────────────────────────────
router.post('/mass', requireAuth, requireAdmin, async (req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No se recibieron datos. Envíe un arreglo de usuarios.' });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const [i, row] of rows.entries()) {
        const full_name    = String(row['Nombre Completo'] || row['full_name'] || '').trim();
        const document_no  = String(row['Documento'] || row['document_no'] || '').trim();
        const email        = String(row['Email'] || row['Correo'] || row['email'] || '').trim();
        const area         = String(row['Area'] || row['Área'] || row['area'] || '').trim();
        const position     = String(row['Cargo'] || row['position'] || '').trim();
        const role         = String(row['Rol'] || row['role'] || 'user').trim().toLowerCase();
        const password_raw = String(row['Contraseña'] || row['Password'] || document_no).trim();

        if (!document_no || !full_name) {
            results.errors.push({ row: i + 2, error: 'Faltan campos obligatorios (Nombre y Documento).' });
            continue;
        }

        // Block privilege escalation from Excel
        const safeRole = ['admin', 'user'].includes(role) ? role : 'user';

        try {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password_raw, salt);
            await pool.query(
                'INSERT INTO users (full_name, area, position, document_no, password_hash, email, role, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [full_name, area, position, document_no, hash, email, safeRole, 1]
            );
            results.created++;
        } catch (err) {
            if (err.code === '23505') { // unique violation
                results.skipped++;
            } else {
                results.errors.push({ row: i + 2, error: err.message });
            }
        }
    }

    res.json({
        message: `Proceso completado: ${results.created} creados, ${results.skipped} duplicados omitidos, ${results.errors.length} errores.`,
        ...results
    });
});

// Toggle user active/suspended status (admin only)
router.put('/:id/toggle-status', requireAuth, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) {
        return res.status(400).json({ error: 'No puede cambiar el estado de su propia cuenta.' });
    }
    try {
        const result = await pool.query(
            'UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = $1 RETURNING is_active',
            [userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const newStatus = result.rows[0].is_active === 1 ? 'Activo' : 'Suspendido';
        res.json({ message: `Usuario ${newStatus} exitosamente.`, is_active: result.rows[0].is_active });
    } catch (err) {
        console.error('[USERS] TOGGLE-STATUS error:', err);
        res.status(500).json({ error: 'Error al cambiar el estado del usuario.' });
    }
});

module.exports = router;
