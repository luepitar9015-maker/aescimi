const express = require('express');
const router = express.Router();
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// ──────────────────────────────────────────────────────────────
// Ensure the expediente_assignments table exists
// ──────────────────────────────────────────────────────────────
pool.query(`
    CREATE TABLE IF NOT EXISTS expediente_assignments (
        id SERIAL PRIMARY KEY,
        expediente_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        assigned_by INTEGER,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'Pendiente',
        observaciones TEXT,
        UNIQUE(expediente_id, user_id)
    )
`).catch(e => console.warn('[SEGUIMIENTO] Table init error:', e.message));

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/estadisticas
// Retorna:
//   - % cargue por dependencia (cuántos expedientes tienen documentos vs total)
//   - % cargue por usuario (documentos cargados por usuario / total documentos)
//   - Resumen general
// ──────────────────────────────────────────────────────────────
router.get('/estadisticas', requireAuth, async (req, res) => {
    try {
        // 1. Total expedientes y % con documentos por dependencia
        const depStats = await pool.query(`
            SELECT
                COALESCE(e.dependencia, 'Sin dependencia') AS dependencia,
                COUNT(DISTINCT e.id)                        AS total_expedientes,
                COUNT(DISTINCT d.expediente_id)             AS expedientes_con_docs,
                COUNT(d.id)                                 AS total_documentos,
                ROUND(
                    CASE WHEN COUNT(DISTINCT e.id) > 0
                         THEN COUNT(DISTINCT d.expediente_id)::NUMERIC / COUNT(DISTINCT e.id) * 100
                         ELSE 0
                    END, 2
                ) AS porcentaje_cargue
            FROM expedientes e
            LEFT JOIN documents d ON d.expediente_id = e.id
            GROUP BY e.dependencia
            ORDER BY total_expedientes DESC
        `);

        // 2. % cargue por usuario (documentos cargados vinculados a expedientes asignados)
        const userStats = await pool.query(`
            SELECT
                u.id            AS user_id,
                u.full_name     AS usuario,
                u.area,
                COUNT(DISTINCT ea.expediente_id)            AS expedientes_asignados,
                COUNT(DISTINCT CASE WHEN d.expediente_id IS NOT NULL THEN ea.expediente_id END) AS expedientes_con_docs,
                COUNT(d.id)                                 AS total_documentos,
                ROUND(
                    CASE WHEN COUNT(DISTINCT ea.expediente_id) > 0
                         THEN COUNT(DISTINCT CASE WHEN d.expediente_id IS NOT NULL THEN ea.expediente_id END)::NUMERIC
                              / COUNT(DISTINCT ea.expediente_id) * 100
                         ELSE 0
                    END, 2
                ) AS porcentaje_cargue
            FROM users u
            LEFT JOIN expediente_assignments ea ON ea.user_id = u.id
            LEFT JOIN documents d ON d.expediente_id = ea.expediente_id
            WHERE u.is_active = 1
            GROUP BY u.id, u.full_name, u.area
            ORDER BY expedientes_asignados DESC
        `);

        // 3. Resumen global
        const globalStats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM expedientes)                      AS total_expedientes,
                (SELECT COUNT(DISTINCT expediente_id) FROM documents)   AS expedientes_con_docs,
                (SELECT COUNT(*) FROM documents)                        AS total_documentos,
                (SELECT COUNT(*) FROM expediente_assignments)           AS total_asignaciones,
                (SELECT COUNT(DISTINCT user_id) FROM expediente_assignments) AS usuarios_con_asignacion,
                ROUND(
                    CASE WHEN (SELECT COUNT(*) FROM expedientes) > 0
                         THEN (SELECT COUNT(DISTINCT expediente_id) FROM documents)::NUMERIC
                              / (SELECT COUNT(*) FROM expedientes) * 100
                         ELSE 0
                    END, 2
                ) AS porcentaje_global
        `);

        // 4. Tendencia de cargue por mes (últimos 6 meses)
        const tendencia = await pool.query(`
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
                COUNT(*) AS documentos_cargados
            FROM documents
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY mes ASC
        `);

        res.json({
            dependencias: depStats.rows,
            usuarios: userStats.rows,
            global: globalStats.rows[0],
            tendencia: tendencia.rows
        });
    } catch (err) {
        console.error('[SEGUIMIENTO] estadisticas error:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/asignaciones
// Lista todas las asignaciones con info de expediente y usuario
// ──────────────────────────────────────────────────────────────
router.get('/asignaciones', requireAuth, async (req, res) => {
    try {
        const { user_id, estado, search } = req.query;
        let conditions = [];
        let params = [];
        let pIdx = 1;

        if (user_id) { conditions.push(`ea.user_id = $${pIdx++}`); params.push(user_id); }
        if (estado)  { conditions.push(`ea.estado = $${pIdx++}`); params.push(estado); }
        if (search)  {
            conditions.push(`(e.title ILIKE $${pIdx} OR e.expediente_code ILIKE $${pIdx} OR u.full_name ILIKE $${pIdx})`);
            params.push(`%${search}%`); pIdx++;
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const result = await pool.query(`
            SELECT
                ea.id,
                ea.expediente_id,
                ea.user_id,
                ea.assigned_at,
                ea.estado,
                ea.observaciones,
                e.title              AS expediente_titulo,
                e.expediente_code,
                e.dependencia,
                e.subserie,
                e.opening_date,
                u.full_name          AS usuario_nombre,
                u.area               AS usuario_area,
                ab.full_name         AS asignado_por,
                (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = ea.expediente_id) AS doc_count
            FROM expediente_assignments ea
            JOIN expedientes e ON e.id = ea.expediente_id
            JOIN users u ON u.id = ea.user_id
            LEFT JOIN users ab ON ab.id = ea.assigned_by
            ${where}
            ORDER BY ea.assigned_at DESC
        `, params);

        res.json({ data: result.rows });
    } catch (err) {
        console.error('[SEGUIMIENTO] asignaciones error:', err);
        res.status(500).json({ error: 'Error al obtener asignaciones: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/mis-asignaciones
// Las asignaciones del usuario autenticado
// ──────────────────────────────────────────────────────────────
router.get('/mis-asignaciones', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ea.id,
                ea.expediente_id,
                ea.assigned_at,
                ea.estado,
                ea.observaciones,
                e.title              AS expediente_titulo,
                e.expediente_code,
                e.dependencia,
                e.subserie,
                e.opening_date,
                ab.full_name         AS asignado_por,
                (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = ea.expediente_id) AS doc_count
            FROM expediente_assignments ea
            JOIN expedientes e ON e.id = ea.expediente_id
            LEFT JOIN users ab ON ab.id = ea.assigned_by
            WHERE ea.user_id = $1
            ORDER BY ea.assigned_at DESC
        `, [req.user.id]);

        res.json({ data: result.rows });
    } catch (err) {
        console.error('[SEGUIMIENTO] mis-asignaciones error:', err);
        res.status(500).json({ error: 'Error al obtener asignaciones: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/seguimiento/asignar
// Asigna uno o varios expedientes a un usuario
// Body: { expediente_ids: [1,2,3], user_id: 5, observaciones: '' }
// ──────────────────────────────────────────────────────────────
router.post('/asignar', requireAuth, requireAdmin, async (req, res) => {
    const { expediente_ids, user_id, observaciones } = req.body;

    if (!expediente_ids || !user_id) {
        return res.status(400).json({ error: 'Se requieren expediente_ids y user_id.' });
    }

    const ids = Array.isArray(expediente_ids) ? expediente_ids : [expediente_ids];
    if (ids.length === 0) return res.status(400).json({ error: 'Sin expedientes.' });

    const client = await pool.connect();
    let assigned = 0;
    let skipped = 0;
    const errors = [];

    try {
        await client.query('BEGIN');
        for (const expId of ids) {
            try {
                await client.query(`
                    INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (expediente_id, user_id) DO UPDATE
                        SET observaciones = EXCLUDED.observaciones,
                            assigned_by = EXCLUDED.assigned_by,
                            assigned_at = CURRENT_TIMESTAMP
                `, [expId, user_id, req.user.id, observaciones || null]);
                assigned++;
            } catch (e) {
                errors.push({ expediente_id: expId, error: e.message });
                skipped++;
            }
        }
        await client.query('COMMIT');
        res.json({ message: `${assigned} asignado(s), ${skipped} omitido(s).`, assigned, skipped, errors });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al asignar expedientes: ' + err.message });
    } finally {
        client.release();
    }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/seguimiento/asignaciones/:id
// Actualiza estado u observaciones de una asignación
// ──────────────────────────────────────────────────────────────
router.put('/asignaciones/:id', requireAuth, async (req, res) => {
    const { estado, observaciones } = req.body;
    const { id } = req.params;

    try {
        // Sólo admin o el propio usuario puede actualizar
        const check = await pool.query('SELECT user_id FROM expediente_assignments WHERE id = $1', [id]);
        if (check.rowCount === 0) return res.status(404).json({ error: 'Asignación no encontrada.' });

        const owner = check.rows[0].user_id;
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.id !== owner) {
            return res.status(403).json({ error: 'Sin permiso para modificar esta asignación.' });
        }

        await pool.query(`
            UPDATE expediente_assignments SET estado = $1, observaciones = $2 WHERE id = $3
        `, [estado, observaciones, id]);
        res.json({ success: true, message: 'Asignación actualizada.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/seguimiento/asignaciones/:id
// Elimina una asignación (sólo admin)
// ──────────────────────────────────────────────────────────────
router.delete('/asignaciones/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM expediente_assignments WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/expedientes-sin-asignar
// Lista expedientes que NO tienen ninguna asignación
// ──────────────────────────────────────────────────────────────
router.get('/expedientes-sin-asignar', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        const param = search ? [`%${search}%`] : ['%%'];
        const result = await pool.query(`
            SELECT e.id, e.expediente_code, e.title, e.dependencia, e.subserie, e.opening_date,
                   (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id) AS doc_count
            FROM expedientes e
            WHERE e.id NOT IN (SELECT DISTINCT expediente_id FROM expediente_assignments)
              AND (e.title ILIKE $1 OR e.expediente_code ILIKE $1 OR e.dependencia ILIKE $1)
            ORDER BY e.created_at DESC
            LIMIT 200
        `, param);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error: ' + err.message });
    }
});

module.exports = router;
