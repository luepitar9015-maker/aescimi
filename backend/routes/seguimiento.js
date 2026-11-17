const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Habilitar extensión unaccent si no existe
pool.query('CREATE EXTENSION IF NOT EXISTS unaccent').catch(e => console.warn('[SEGUIMIENTO] unaccent extension patch error:', e.message));

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

// Ensure paquete_id column exists if table was created previously without it
pool.query(`
    ALTER TABLE expediente_assignments ADD COLUMN IF NOT EXISTS paquete_id INTEGER;
`).catch(e => console.warn('[SEGUIMIENTO] Column paquete_id patch error:', e.message));

// Deduplicate and apply UNIQUE constraint to expediente_assignments table
pool.query(`
    DELETE FROM expediente_assignments a
    USING expediente_assignments b
    WHERE a.id < b.id 
      AND a.expediente_id = b.expediente_id 
      AND a.user_id = b.user_id;
`).then(() => {
    console.log('[MIGRATION] Duplicates removed from expediente_assignments.');
    return pool.query(`
        ALTER TABLE expediente_assignments ADD CONSTRAINT expediente_assignments_unique_exp_user UNIQUE (expediente_id, user_id);
    `);
}).then(() => {
    console.log('[MIGRATION] UNIQUE constraint added to expediente_assignments.');
}).catch(e => {
    console.warn('[MIGRATION] Constraint/Deduplication check info:', e.message);
});

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

// ────────────────�// ──────────────────────────────────────────────────────────────
// Helper: garantiza permisos TRD (can_view=1, can_upload=1) cuando se asignan expedientes o paquetes
async function ensureUserTrdPermsOnAssign(client, userId, expedienteIds) {
    const uId = Number(userId);
    const cleanExps = [...new Set((expedienteIds || []).map(Number).filter(Boolean))];
    if (!uId || cleanExps.length === 0) return;

    const uRes = await client.query(
        `SELECT id FROM users WHERE id = $1 AND role NOT IN ('admin', 'superadmin')`,
        [uId]
    );
    if (uRes.rowCount === 0) return;

    const trdRes = await client.query(`
        SELECT DISTINCT
            sub.id AS subseries_id,
            CASE WHEN sub.id IS NULL THEN ser.id ELSE NULL END AS series_id
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series ser ON (sub.series_id = ser.id OR e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code)
        WHERE e.id = ANY($1::int[])
          AND (sub.id IS NOT NULL OR ser.id IS NOT NULL)
    `, [cleanExps]);

    for (const row of trdRes.rows) {
        const existing = await client.query(
            `SELECT id FROM user_trd_permissions
             WHERE user_id = $1
               AND series_id IS NOT DISTINCT FROM $2
               AND subseries_id IS NOT DISTINCT FROM $3
             LIMIT 1`,
            [uId, row.series_id, row.subseries_id]
        );
        if (existing.rowCount > 0) {
            await client.query(
                `UPDATE user_trd_permissions SET can_view = 1, can_upload = 1 WHERE id = $1`,
                [existing.rows[0].id]
            );
        } else {
            await client.query(
                `INSERT INTO user_trd_permissions (user_id, series_id, subseries_id, can_view, can_upload)
                 VALUES ($1, $2, $3, 1, 1)`,
                [uId, row.series_id, row.subseries_id]
            );
        }
    }
}

router.get('/estadisticas', requireAuth, async (req, res) => {
    try {
        // 1. Avance individual por expediente (pre-agregado sin producto cartesiano)
        const expAvance = await pool.query(`
            WITH doc_typs AS (
                SELECT expediente_id, UPPER(UNACCENT(typology_name)) AS norm_typ
                FROM documents
                WHERE expediente_id IS NOT NULL AND typology_name IS NOT NULL
                GROUP BY expediente_id, UPPER(UNACCENT(typology_name))
            ),
            doc_counts AS (
                SELECT
                    expediente_id,
                    COUNT(*) AS total_docs,
                    COUNT(*) FILTER (WHERE status = 'Cargado') AS docs_cargados_aes
                FROM documents
                WHERE expediente_id IS NOT NULL
                GROUP BY expediente_id
            ),
            tt_norm AS (
                SELECT id, subseries_id, series_id, UPPER(UNACCENT(typology_name)) AS norm_typ
                FROM trd_typologies
            )
            SELECT 
                e.id, 
                e.expediente_code, 
                e.title, 
                COALESCE(
                    NULLIF(TRIM(org.subsection_name), ''),
                    NULLIF(TRIM(org.section_name), ''),
                    NULLIF(TRIM(e.dependencia), ''),
                    'Sin dependencia'
                ) as dependencia, 
                e.subserie,
                COUNT(DISTINCT tt.id) as total_requeridos,
                COUNT(DISTINCT CASE WHEN dt.norm_typ IS NOT NULL THEN tt.id END) as cargados,
                COALESCE(dc.docs_cargados_aes, 0) as docs_cargados_aes,
                COALESCE(dc.total_docs, 0) as total_docs,
                ROUND(
                    CASE WHEN COUNT(DISTINCT tt.id) > 0
                         THEN COUNT(DISTINCT CASE WHEN dt.norm_typ IS NOT NULL THEN tt.id END)::NUMERIC / COUNT(DISTINCT tt.id) * 100
                         ELSE 0
                    END, 2
                ) as avance
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (sub.series_id = ser.id OR e.subserie = ser.series_code)
            LEFT JOIN organization_structure org ON ser.dependency_id = org.id
            LEFT JOIN tt_norm tt ON (tt.subseries_id = sub.id OR (tt.subseries_id IS NULL AND tt.series_id = ser.id))
            LEFT JOIN doc_typs dt ON dt.expediente_id = e.id AND dt.norm_typ = tt.norm_typ
            LEFT JOIN doc_counts dc ON dc.expediente_id = e.id
            GROUP BY e.id, org.subsection_name, org.section_name, dc.docs_cargados_aes, dc.total_docs
            ORDER BY e.created_at DESC
        `);

        // Derivar avance por dependencia y suma global de tipologías desde expAvance (sin recalcular 3 veces en BD)
        const depMap = new Map();
        let sumTotalReqGlobal = 0;
        let sumCargadosGlobal = 0;
        const expCargadosMap = new Map();

        for (const row of expAvance.rows) {
            const dep = row.dependencia || 'Sin dependencia';
            const reqCount = Number(row.total_requeridos) || 0;
            const cargCount = Number(row.cargados) || 0;
            const totDocs = Number(row.total_docs) || 0;
            const aesDocs = Number(row.docs_cargados_aes) || 0;

            sumTotalReqGlobal += reqCount;
            sumCargadosGlobal += cargCount;
            expCargadosMap.set(row.id, cargCount);

            if (!depMap.has(dep)) {
                depMap.set(dep, {
                    dependencia: dep,
                    total_expedientes: 0,
                    expedientes_con_docs: 0,
                    sum_req: 0,
                    sum_carg: 0,
                    total_documentos: 0,
                    expedientes_cargados_aes: 0,
                    documentos_cargados_aes: 0
                });
            }
            const d = depMap.get(dep);
            d.total_expedientes += 1;
            if (totDocs > 0) d.expedientes_con_docs += 1;
            d.sum_req += reqCount;
            d.sum_carg += cargCount;
            d.total_documentos += totDocs;
            if (aesDocs > 0) d.expedientes_cargados_aes += 1;
            d.documentos_cargados_aes += aesDocs;
        }

        const depStatsRows = Array.from(depMap.values())
            .sort((a, b) => b.total_expedientes - a.total_expedientes)
            .map(d => ({
                dependencia: d.dependencia,
                total_expedientes: String(d.total_expedientes),
                expedientes_con_docs: String(d.expedientes_con_docs),
                porcentaje_cargue: d.sum_req > 0 ? (d.sum_carg / d.sum_req * 100).toFixed(2) : '0.00',
                total_documentos: String(d.total_documentos),
                expedientes_cargados_aes: String(d.expedientes_cargados_aes),
                documentos_cargados_aes: String(d.documentos_cargados_aes)
            }));

        // 2. Avance real por usuario (pre-agregado por CTE sin subconsultas correlacionadas), resumen global y tendencia en paralelo
        const [userStats, globalCounts, tendencia] = await Promise.all([
            pool.query(`
                WITH doc_exp AS (
                    SELECT DISTINCT expediente_id FROM documents WHERE expediente_id IS NOT NULL
                ),
                ea_agg AS (
                    SELECT
                        ea.user_id,
                        COUNT(DISTINCT ea.expediente_id) AS expedientes_asignados,
                        COUNT(DISTINCT CASE WHEN de.expediente_id IS NOT NULL THEN ea.expediente_id END) AS expedientes_con_docs
                    FROM expediente_assignments ea
                    LEFT JOIN doc_exp de ON de.expediente_id = ea.expediente_id
                    GROUP BY ea.user_id
                ),
                user_docs_union AS (
                    SELECT d.user_id AS uid, d.id AS doc_id, d.expediente_id, d.status, d.created_at, d.user_id AS orig_uid
                    FROM documents d
                    WHERE d.user_id IS NOT NULL
                    UNION
                    SELECT ea.user_id AS uid, d.id AS doc_id, d.expediente_id, d.status, d.created_at, d.user_id AS orig_uid
                    FROM expediente_assignments ea
                    INNER JOIN documents d ON d.expediente_id = ea.expediente_id
                ),
                ud_agg AS (
                    SELECT
                        uid AS user_id,
                        COUNT(*) FILTER (WHERE orig_uid = uid OR orig_uid IS NULL) AS total_documentos,
                        COUNT(DISTINCT expediente_id) FILTER (WHERE status = 'Cargado' AND expediente_id IS NOT NULL) AS expedientes_cargados_aes,
                        COUNT(*) FILTER (WHERE status = 'Cargado') AS documentos_cargados_aes,
                        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS docs_hoy
                    FROM user_docs_union
                    GROUP BY uid
                )
                SELECT
                    u.id AS user_id,
                    u.full_name AS usuario,
                    u.area,
                    COALESCE(ea_agg.expedientes_asignados, 0) AS expedientes_asignados,
                    COALESCE(ea_agg.expedientes_con_docs, 0) AS expedientes_con_docs,
                    ROUND(
                        CASE WHEN COALESCE(ea_agg.expedientes_asignados, 0) > 0
                             THEN COALESCE(ea_agg.expedientes_con_docs, 0)::NUMERIC / ea_agg.expedientes_asignados * 100
                             ELSE 0
                        END, 1
                    ) AS porcentaje_cargue,
                    COALESCE(ud_agg.total_documentos, 0) AS total_documentos,
                    COALESCE(ud_agg.expedientes_cargados_aes, 0) AS expedientes_cargados_aes,
                    COALESCE(ud_agg.documentos_cargados_aes, 0) AS documentos_cargados_aes,
                    COALESCE(ud_agg.docs_hoy, 0) AS docs_hoy
                FROM users u
                LEFT JOIN ea_agg ON ea_agg.user_id = u.id
                LEFT JOIN ud_agg ON ud_agg.user_id = u.id
                WHERE u.is_active = 1
                ORDER BY COALESCE(ea_agg.expedientes_asignados, 0) DESC
            `),
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM expedientes) AS total_expedientes,
                    (SELECT COUNT(DISTINCT expediente_id) FROM documents WHERE expediente_id IS NOT NULL) AS expedientes_con_docs,
                    (SELECT COUNT(*) FROM documents) AS total_documentos,
                    (SELECT COUNT(*) FROM expediente_assignments) AS total_asignaciones,
                    (SELECT COUNT(DISTINCT user_id) FROM expediente_assignments) AS usuarios_con_asignacion,
                    (SELECT COUNT(DISTINCT expediente_id) FROM documents WHERE status = 'Cargado' AND expediente_id IS NOT NULL) AS expedientes_cargados_aes,
                    (SELECT COUNT(*) FROM documents WHERE status = 'Cargado') AS documentos_cargados_aes,
                    (SELECT COUNT(*) FROM documents WHERE status = 'Pendiente' OR status IS NULL) AS documentos_pendientes_aes
            `),
            pool.query(`
                SELECT
                    TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
                    COUNT(*) AS documentos_cargados
                FROM documents
                WHERE created_at >= NOW() - INTERVAL '6 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY mes ASC
            `)
        ]);

        const globalRow = {
            ...globalCounts.rows[0],
            porcentaje_global: sumTotalReqGlobal > 0 ? (sumCargadosGlobal / sumTotalReqGlobal * 100).toFixed(2) : '0.00'
        };

        res.json({
            dependencias: depStatsRows,
            usuarios: userStats.rows,
            expedientes: expAvance.rows,
            global: globalRow,
            tendencia: tendencia.rows
        });
    } catch (err) {
        console.error('[SEGUIMIENTO] estadisticas error:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas: ' + err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// GET /api/seguimiento/exportar-pendientes-excel
// Exporta reporte de expedientes pendientes por cargar por responsable (para Dirección)
// ──────────────────────────────────────────────────────────────
router.get('/exportar-pendientes-excel', requireAuth, async (req, res) => {
    try {
        let { user_id, solo_pendientes } = req.query;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

        // Si no es admin/superadmin, solo puede exportar sus propios expedientes
        if (!isAdmin) {
            user_id = req.user.id;
        }

        const filtrarSoloPendientes = solo_pendientes !== 'false';

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        let filteredUserName = '';

        if (user_id && user_id !== 'todos') {
            whereClauses.push(`ea.user_id = $${pIdx++}`);
            params.push(Number(user_id));

            const uRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [Number(user_id)]);
            if (uRes.rowCount > 0) {
                filteredUserName = uRes.rows[0].full_name;
            }
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            WITH exp_detalle AS (
                SELECT 
                    e.id AS expediente_id,
                    COALESCE(NULLIF(e.expediente_code, ''), 'EXP-' || e.id) AS expediente_code,
                    COALESCE(NULLIF(e.title, ''), 'Sin Título') AS expediente_titulo,
                    COALESCE(e.dependencia, 'Sin Dependencia') AS dependencia,
                    COALESCE(e.subserie, 'Sin Subserie') AS subserie,
                    e.opening_date,
                    u.id AS user_id,
                    COALESCE(u.full_name, 'Sin Asignar') AS responsable,
                    COALESCE(u.document_no, '—') AS responsable_doc,
                    COALESCE(u.area, '—') AS responsable_area,
                    COALESCE(ea.estado, 'Pendiente') AS estado_asignacion,
                    COALESCE(ea.observaciones, '—') AS observaciones,
                    COUNT(DISTINCT tt.id) AS total_requeridos,
                    COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN tt.id END) AS cargados,
                    (COUNT(DISTINCT tt.id) - COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN tt.id END)) AS faltantes,
                    ROUND(
                        CASE WHEN COUNT(DISTINCT tt.id) > 0
                             THEN (COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN tt.id END)::NUMERIC / COUNT(DISTINCT tt.id) * 100)
                             ELSE 0
                        END, 1
                    ) AS avance_porcentaje,
                    STRING_AGG(DISTINCT CASE WHEN d.id IS NULL THEN tt.typology_name END, ' | ') AS tipologias_faltantes_nombres,
                    (SELECT COUNT(*) FROM documents doc WHERE doc.expediente_id = e.id) AS total_docs_cargados
                FROM expedientes e
                LEFT JOIN expediente_assignments ea ON e.id = ea.expediente_id
                LEFT JOIN users u ON ea.user_id = u.id
                LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
                LEFT JOIN trd_series ser ON (sub.series_id = ser.id OR e.subserie = ser.series_code)
                LEFT JOIN trd_typologies tt ON (tt.subseries_id = sub.id OR (tt.subseries_id IS NULL AND tt.series_id = ser.id))
                LEFT JOIN documents d ON d.expediente_id = e.id AND UPPER(UNACCENT(d.typology_name)) = UPPER(UNACCENT(tt.typology_name))
                ${whereSql}
                GROUP BY e.id, e.expediente_code, e.title, e.dependencia, e.subserie, e.opening_date,
                         u.id, u.full_name, u.document_no, u.area, ea.estado, ea.observaciones
            )
            SELECT * FROM exp_detalle
            ${filtrarSoloPendientes ? 'WHERE (cargados < total_requeridos OR total_docs_cargados = 0 OR avance_porcentaje < 100)' : ''}
            ORDER BY responsable ASC, avance_porcentaje ASC, expediente_code ASC
        `;

        const dbRes = await pool.query(query, params);

        // Armar resumen ejecutivo por responsable
        const resumenMap = new Map();
        for (const row of dbRes.rows) {
            const resp = row.responsable;
            if (!resumenMap.has(resp)) {
                resumenMap.set(resp, {
                    responsable: resp,
                    documento: row.responsable_doc,
                    area: row.responsable_area,
                    total_expedientes: 0,
                    exp_pendientes: 0,
                    exp_completados: 0,
                    docs_faltantes: 0,
                    sum_avance: 0
                });
            }
            const r = resumenMap.get(resp);
            r.total_expedientes++;
            const pct = Number(row.avance_porcentaje) || 0;
            r.sum_avance += pct;
            if (pct >= 100) {
                r.exp_completados++;
            } else {
                r.exp_pendientes++;
                r.docs_faltantes += Math.max(0, Number(row.faltantes) || 0);
            }
        }

        const resumenRows = Array.from(resumenMap.values()).map(r => {
            const avgAvance = (r.sum_avance / (r.total_expedientes || 1));
            return {
                'Responsable': r.responsable,
                'No. Documento': r.documento,
                'Área / Coordinación': r.area,
                'Total Exp. Asignados': r.total_expedientes,
                'Exp. Pendientes por Cargar': r.exp_pendientes,
                'Exp. 100% Completados': r.exp_completados,
                'Total Tipologías Faltantes': r.docs_faltantes,
                '% Avance Promedio': `${avgAvance.toFixed(1)}%`,
                'Estado de Cumplimiento': avgAvance >= 80 ? 'Al Día (80-100%)' : avgAvance >= 40 ? 'En Proceso (40-79%)' : 'Pendiente Crítico (<40%)'
            };
        });

        // Armar filas de detalle de cada expediente
        const detalleRows = dbRes.rows.map((row, idx) => {
            const pct = Number(row.avance_porcentaje) || 0;
            const estadoCargue = pct >= 100 
                ? 'Completado (100%)' 
                : pct === 0 && Number(row.total_docs_cargados) === 0 
                    ? 'Sin Iniciar (0% Docs)' 
                    : `Incompleto (${pct}%)`;

            const fechaApertura = row.opening_date 
                ? new Date(row.opening_date).toISOString().split('T')[0] 
                : '—';

            return {
                'N°': idx + 1,
                'Responsable': row.responsable,
                'Cédula / No. Documento': row.responsable_doc,
                'Área / Coordinación': row.responsable_area,
                'Código Expediente': row.expediente_code,
                'Título del Expediente': row.expediente_titulo,
                'Dependencia': row.dependencia,
                'Serie / Subserie TRD': row.subserie,
                'Fecha Apertura': fechaApertura,
                'Estado Asignación': row.estado_asignacion,
                'Tipologías Requeridas': Number(row.total_requeridos) || 0,
                'Tipologías Cargadas': Number(row.cargados) || 0,
                'Tipologías Faltantes (Cant.)': Math.max(0, Number(row.faltantes) || 0),
                '% Avance': `${pct}%`,
                'Estado de Cargue': estadoCargue,
                'Documentos Pendientes por Cargar': row.tipologias_faltantes_nombres || 'Ninguno (Al Día)',
                'Observaciones / Detalle': row.observaciones
            };
        });

        const wb = xlsx.utils.book_new();

        // 1. Hoja Resumen Dirección
        const wsResumen = xlsx.utils.json_to_sheet(resumenRows);
        wsResumen['!cols'] = [
            { wch: 35 }, // Responsable
            { wch: 18 }, // Doc
            { wch: 42 }, // Área
            { wch: 22 }, // Total Exp
            { wch: 26 }, // Exp Pendientes
            { wch: 22 }, // Exp Completados
            { wch: 26 }, // Tipologías Faltantes
            { wch: 20 }, // % Avance Promedio
            { wch: 26 }  // Estado de Cumplimiento
        ];
        xlsx.utils.book_append_sheet(wb, wsResumen, 'Resumen_Dirección');

        // 2. Hoja Detalle Expedientes Pendientes
        const wsDetalle = xlsx.utils.json_to_sheet(detalleRows);
        wsDetalle['!cols'] = [
            { wch: 6 },  // N°
            { wch: 32 }, // Responsable
            { wch: 20 }, // Cédula
            { wch: 36 }, // Área
            { wch: 22 }, // Código
            { wch: 45 }, // Título
            { wch: 35 }, // Dependencia
            { wch: 24 }, // Subserie
            { wch: 16 }, // Fecha
            { wch: 18 }, // Estado Asig
            { wch: 20 }, // Req
            { wch: 18 }, // Cargadas
            { wch: 24 }, // Faltantes
            { wch: 14 }, // % Avance
            { wch: 24 }, // Estado Cargue
            { wch: 75 }, // Tipologías Faltantes Detalladas
            { wch: 35 }  // Observaciones
        ];
        xlsx.utils.book_append_sheet(wb, wsDetalle, 'Detalle_Pendientes');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const fechaStr = new Date().toISOString().split('T')[0];
        const sanitizedUserName = filteredUserName 
            ? filteredUserName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) 
            : null;

        const filename = sanitizedUserName
            ? `Expedientes_Pendientes_${sanitizedUserName}_${fechaStr}.xlsx`
            : `Informe_Direccion_Expedientes_Pendientes_${fechaStr}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('[SEGUIMIENTO] Error exportando expedientes pendientes a Excel:', err);
        res.status(500).json({ error: 'Error al exportar expedientes pendientes a Excel: ' + err.message });
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
                COALESCE(NULLIF(TRIM(e.title), ''), trd_meta.trd_name, e.subserie) AS expediente_titulo,
                e.expediente_code,
                COALESCE(NULLIF(TRIM(e.dependencia), ''), trd_meta.dep_name) AS dependencia,
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
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(sub.subseries_name, ser.series_name) AS trd_name,
                    COALESCE(NULLIF(TRIM(org.subsection_name), ''), NULLIF(TRIM(org.section_name), '')) AS dep_name
                FROM trd_series ser
                LEFT JOIN trd_subseries sub ON sub.series_id = ser.id AND (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                WHERE sub.id IS NOT NULL OR e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code
                ORDER BY sub.id NULLS LAST
                LIMIT 1
            ) trd_meta ON TRUE
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
                COALESCE(NULLIF(TRIM(e.title), ''), trd_min.trd_name, e.subserie) AS expediente_titulo,
                e.expediente_code,
                COALESCE(NULLIF(TRIM(e.dependencia), ''), trd_min.dep_name) AS dependencia,
                e.subserie,
                e.opening_date,
                ab.full_name         AS asignado_por,
                (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = ea.expediente_id) AS doc_count
            FROM expediente_assignments ea
            JOIN expedientes e ON e.id = ea.expediente_id
            LEFT JOIN users ab ON ab.id = ea.assigned_by
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(sub.subseries_name, ser.series_name) AS trd_name,
                    COALESCE(NULLIF(TRIM(org.subsection_name), ''), NULLIF(TRIM(org.section_name), '')) AS dep_name
                FROM trd_series ser
                LEFT JOIN trd_subseries sub ON sub.series_id = ser.id AND (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                WHERE sub.id IS NOT NULL OR e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code
                ORDER BY sub.id NULLS LAST
                LIMIT 1
            ) trd_min ON TRUE
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
        await ensureUserTrdPermsOnAssign(client, user_id, ids);
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
            `SELECT p.id, p.nombre, p.descripcion, p.estado, p.created_at, p.user_id,
                    u.full_name AS usuario_nombre,
                    cb.full_name AS creado_por,
                    COUNT(DISTINCT pi.expediente_id) AS total_expedientes,
                    (SELECT COUNT(*) FROM documents d JOIN paquete_items pi2 ON d.expediente_id = pi2.expediente_id WHERE pi2.paquete_id = p.id) AS total_docs,
                    (SELECT COUNT(*) FROM documents d JOIN paquete_items pi2 ON d.expediente_id = pi2.expediente_id WHERE pi2.paquete_id = p.id AND d.status = 'Cargado') AS docs_cargados
             FROM expediente_paquetes p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN users cb ON cb.id = p.created_by
             LEFT JOIN paquete_items pi ON pi.paquete_id = p.id
             ${isAdmin ? '' : 'WHERE p.user_id = $1'}
             GROUP BY p.id, u.full_name, cb.full_name, p.user_id
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
            SELECT e.id, e.expediente_code,
                   COALESCE(NULLIF(TRIM(e.title), ''), trd_paq.trd_name, e.subserie) AS title,
                   COALESCE(NULLIF(TRIM(e.dependencia), ''), trd_paq.dep_name) AS dependencia,
                   e.subserie,
                   ea.estado AS estado_asignacion,
                   (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id) AS doc_count,
                   (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id AND d.status = 'Cargado') AS docs_cargados
            FROM paquete_items pi
            JOIN expedientes e ON e.id = pi.expediente_id
            LEFT JOIN expediente_assignments ea ON ea.expediente_id = e.id AND ea.paquete_id = $1
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(sub.subseries_name, ser.series_name) AS trd_name,
                    COALESCE(NULLIF(TRIM(org.subsection_name), ''), NULLIF(TRIM(org.section_name), '')) AS dep_name
                FROM trd_series ser
                LEFT JOIN trd_subseries sub ON sub.series_id = ser.id AND (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                WHERE sub.id IS NOT NULL OR e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code
                ORDER BY sub.id NULLS LAST
                LIMIT 1
            ) trd_paq ON TRUE
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
        await ensureUserTrdPermsOnAssign(client, user_id, expediente_ids);
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

// POST /api/seguimiento/validar-primer-doc-lote
// Validación masiva instantánea (<15ms) en 1 sola consulta para cientos o miles de expedientes (4000+)
router.post('/validar-primer-doc-lote', requireAuth, async (req, res) => {
    try {
        const rawIds = Array.isArray(req.body?.expedienteIds) ? req.body.expedienteIds : [];
        const expIds = [...new Set(rawIds.map(x => parseInt(x, 10)).filter(x => Number.isInteger(x) && x > 0))];
        if (expIds.length === 0) {
            return res.json({ success: true, missingByExpId: {} });
        }

        const [serRes, subRes, typRes, expRes, docsRes] = await Promise.all([
            pool.query('SELECT id, series_code FROM trd_series'),
            pool.query('SELECT id, series_id, subseries_code FROM trd_subseries'),
            pool.query('SELECT id, series_id, subseries_id, typology_name FROM trd_typologies ORDER BY id ASC'),
            pool.query('SELECT id, subserie FROM expedientes WHERE id = ANY($1::int[])', [expIds]),
            pool.query('SELECT expediente_id, typology_name FROM documents WHERE expediente_id = ANY($1::int[]) AND typology_name IS NOT NULL', [expIds])
        ]);

        const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const subRows = subRes.rows || [];
        const serRows = serRes.rows || [];
        const typRows = typRes.rows || [];

        const firstTypBySubId = new Map();
        const firstTypBySerId = new Map();
        for (const t of typRows) {
            if (!t.typology_name) continue;
            if (t.subseries_id && !firstTypBySubId.has(t.subseries_id)) {
                firstTypBySubId.set(t.subseries_id, t.typology_name);
            } else if (!t.subseries_id && t.series_id && !firstTypBySerId.has(t.series_id)) {
                firstTypBySerId.set(t.series_id, t.typology_name);
            }
        }

        const uploadedByExp = new Map();
        for (const d of (docsRes.rows || [])) {
            if (!uploadedByExp.has(d.expediente_id)) uploadedByExp.set(d.expediente_id, new Set());
            uploadedByExp.get(d.expediente_id).add(norm(d.typology_name));
        }

        const missingByExpId = {};
        for (const e of (expRes.rows || [])) {
            const eSub = String(e.subserie || '').trim();
            if (!eSub) continue;
            const sb = subRows.find(x => x.subseries_code === eSub || eSub.toUpperCase().endsWith('-' + String(x.subseries_code || '').toUpperCase()));
            const sr = sb ? serRows.find(s => s.id === sb.series_id) : serRows.find(s => s.series_code === eSub);
            const firstTyp = (sb && firstTypBySubId.get(sb.id)) || (sr && firstTypBySerId.get(sr.id)) || null;
            if (!firstTyp) continue;
            const haveSet = uploadedByExp.get(e.id);
            if (!haveSet || !haveSet.has(norm(firstTyp))) {
                missingByExpId[e.id] = firstTyp;
            }
        }

        return res.json({ success: true, missingByExpId });
    } catch (err) {
        return res.json({ success: true, missingByExpId: {}, warning: err.message });
    }
});

module.exports = router;

