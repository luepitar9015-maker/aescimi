const express = require('express');
const router = express.Router();
const db = require('../database');
const pool = db.pool; // pool de PostgreSQL — usado directamente para evitar el wrapper RETURNING id
const { requireAuth } = require('../middleware/authMiddleware');

// Crear tabla al arrancar si no existe
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key   TEXT PRIMARY KEY NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('[Settings] Tabla system_settings verificada.');
    } catch (e) {
        console.warn('[Settings] Tabla system_settings:', e.message);
    }
})();

// ENDPOINT TEMPORAL PARA FIXEAR AES SIN AUTH
router.get('/fix-aes', async (req, res) => {
    try {
        const password = process.env.ADES_PASSWORD || 'CAMBIAR_ESTO_LUEGO';
        const queries = [
            pool.query("INSERT INTO system_settings (key, value) VALUES ('ades_url', 'https://onbase.sena.edu.co/Onbase/Login.aspx') ON CONFLICT (key) DO UPDATE SET value = 'https://onbase.sena.edu.co/Onbase/Login.aspx'"),
            pool.query("INSERT INTO system_settings (key, value) VALUES ('ades_username', 'JRROZO') ON CONFLICT (key) DO UPDATE SET value = 'JRROZO'"),
            pool.query(`INSERT INTO system_settings (key, value) VALUES ('ades_password', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [password])
        ];
        await Promise.all(queries);
        res.send("<h1>LISTO! Credenciales AES guardadas y forzadas en BD. Ya puede cerrar esta pestaña e ir a probar el cargue.</h1>");
    } catch (err) {
        res.status(500).send(`Error guardando fix: ${err.message}`);
    }
});

// GET /api/settings/all — cualquier usuario autenticado
router.get('/all', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT key, value FROM system_settings');
        const settings = {};
        result.rows.forEach(row => { settings[row.key] = row.value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener configuraciones.', detail: err.message });
    }
});

// GET /api/settings/:key
router.get('/:key', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT value FROM system_settings WHERE key = $1', [req.params.key]);
        res.json({ value: result.rows[0] ? result.rows[0].value : null });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener configuración.', detail: err.message });
    }
});

// POST /api/settings — guardar setting
// ades_url/ades_username/ades_password: cualquier usuario autenticado
// Resto: solo admin/superadmin
router.post('/', requireAuth, async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    const isAesKey = ['ades_url', 'ades_username', 'ades_password'].includes(key);
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

    if (!isAesKey && !isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }

    try {
        await pool.query(
            `INSERT INTO system_settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            [key, value]
        );
        res.json({ message: 'Setting updated successfully', key, value });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar configuración.', detail: err.message });
    }
});

module.exports = router;
