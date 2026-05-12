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
        paquete_id INTEGER,
        UNIQUE(expediente_id, user_id)
    )
`).catch(e => console.warn('[SEGUIMIENTO] Table init error:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS expediente_paquetes (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        user_id INTEGER NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'Activo'
    )
`).catch(e => console.warn('[SEGUIMIENTO] paquetes table error:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS paquete_items (
        id SERIAL PRIMARY KEY,
        paquete_id INTEGER NOT NULL,
        expediente_id INTEGER NOT NULL,
        UNIQUE(paquete_id, expediente_id)
    )
`).catch(e => console.warn('[SEGUIMIENTO] paquete_items table error:', e.message));

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

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/paquetes
// ──────────────────────────────────────────────────────────────
router.get('/paquetes', requireAuth, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        const result = await pool.query(
            `SELECT p.id, p.nombre, p.descripcion, p.estado, p.created_at,
                    u.full_name AS usuario_nombre,
                    cb.full_name AS creado_por,
                    COUNT(pi.expediente_id) AS total_expedientes
             FROM expediente_paquetes p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN users cb ON cb.id = p.created_by
             LEFT JOIN paquete_items pi ON pi.paquete_id = p.id
             ${isAdmin ? '' : 'WHERE p.user_id = $1'}
             GROUP BY p.id, u.full_name, cb.full_name
             ORDER BY p.created_at DESC`,
            isAdmin ? [] : [req.user.id]
        );
        res.json({ data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/seguimiento/paquetes/:id/expedientes
router.get('/paquetes/:id/expedientes', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id, e.expediente_code, e.title, e.dependencia, e.subserie,
                   ea.estado AS estado_asignacion,
                   (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id) AS doc_count,
                   (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id AND d.status = 'Cargado') AS docs_cargados
            FROM paquete_items pi
            JOIN expedientes e ON e.id = pi.expediente_id
            LEFT JOIN expediente_assignments ea ON ea.expediente_id = e.id AND ea.paquete_id = $1
            WHERE pi.paquete_id = $1
            ORDER BY e.expediente_code
        `, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/seguimiento/paquetes — Crear paquete y asignar al usuario
router.post('/paquetes', requireAuth, requireAdmin, async (req, res) => {
    const { nombre, descripcion, user_id, expediente_ids } = req.body;
    if (!nombre || !user_id || !Array.isArray(expediente_ids) || expediente_ids.length === 0)
        return res.status(400).json({ error: 'Se requiere nombre, user_id y expediente_ids.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pRes = await client.query(
            `INSERT INTO expediente_paquetes (nombre, descripcion, user_id, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
            [nombre, descripcion || null, user_id, req.user.id]
        );
        const paqueteId = pRes.rows[0].id;
        for (const expId of expediente_ids) {
            await client.query(
                `INSERT INTO paquete_items (paquete_id, expediente_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [paqueteId, expId]
            );
            await client.query(`
                INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, paquete_id, observaciones)
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (expediente_id, user_id) DO UPDATE
                    SET paquete_id = EXCLUDED.paquete_id, assigned_by = EXCLUDED.assigned_by, assigned_at = CURRENT_TIMESTAMP
            `, [expId, user_id, req.user.id, paqueteId, `Paquete: ${nombre}`]);
        }
        await client.query('COMMIT');
        res.json({ message: `Paquete "${nombre}" creado con ${expediente_ids.length} expedientes.`, paquete_id: paqueteId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// DELETE /api/seguimiento/paquetes/:id
router.delete('/paquetes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM paquete_items WHERE paquete_id = $1', [req.params.id]);
        await pool.query('DELETE FROM expediente_paquetes WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/seguimiento/auto-asignar — Llamado al subir un documento
router.post('/auto-asignar', requireAuth, async (req, res) => {
    const { expediente_id, user_id } = req.body;
    if (!expediente_id || !user_id) return res.json({ skipped: true });
    try {
        const pkg = await pool.query(`
            SELECT p.id, p.nombre FROM paquete_items pi
            JOIN expediente_paquetes p ON p.id = pi.paquete_id
            WHERE pi.expediente_id = $1 AND p.user_id = $2 LIMIT 1
        `, [expediente_id, user_id]);
        if (pkg.rowCount === 0) return res.json({ skipped: true });
        const paq = pkg.rows[0];
        await pool.query(`
            INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, paquete_id, estado, observaciones)
            VALUES ($1,$2,$2,$3,'En Proceso','Auto-asignado al cargar documento')
            ON CONFLICT (expediente_id, user_id) DO UPDATE SET estado = 'En Proceso', assigned_at = CURRENT_TIMESTAMP
        `, [expediente_id, user_id, paq.id]);
        res.json({ assigned: true, paquete: paq.nombre });
    } catch (err) {
        res.json({ skipped: true, error: err.message });
    }
});

// GET /api/seguimiento/validar-primer-doc/:expediente_id
// Valida si el primer documento de la serie/subserie ya fue cargado
router.get('/validar-primer-doc/:expediente_id', requireAuth, async (req, res) => {
    try {
        const { pool: pg } = require('../database_pg');
        // Obtener la primera tipología de la serie/subserie del expediente
        const result = await pg.query(`
            SELECT tt.typology_name,
                   (SELECT COUNT(*) FROM documents d
                    WHERE d.expediente_id = $1
                      AND UPPER(UNACCENT(d.typology_name)) = UPPER(UNACCENT(tt.typology_name))
                   ) AS ya_cargado
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (sub.series_id = ser.id OR e.subserie = ser.series_code)
            LEFT JOIN trd_typologies tt ON (tt.subseries_id = sub.id OR (tt.subseries_id IS NULL AND tt.series_id = ser.id))
            WHERE e.id = $1
            ORDER BY tt.id ASC
            LIMIT 1
        `, [req.params.expediente_id]);

        if (result.rowCount === 0) return res.json({ valid: true, message: 'Sin tipologías configuradas.' });
        const row = result.rows[0];
        res.json({
            valid: Number(row.ya_cargado) > 0,
            primer_documento: row.typology_name,
            ya_cargado: Number(row.ya_cargado) > 0
        });
    } catch (err) {
        res.json({ valid: true, error: err.message }); // No bloquear si falla la validación
    }
});

module.exports = router;

