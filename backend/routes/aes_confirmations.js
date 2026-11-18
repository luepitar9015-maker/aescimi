const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../database_pg');
const { requireAuth } = require('../middleware/authMiddleware');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) {}

const DEFAULT_RECIPIENT_EMAIL = 'leparadam@sena.edu.co';

const REPORTS_DIR = (() => {
    if (process.platform === 'linux' && fs.existsSync('/mnt/almacen')) {
        const d = '/mnt/almacen/confirmaciones_aes';
        try { fs.mkdirSync(d, { recursive: true }); return d; } catch (_) {}
    }
    const localDir = path.join(__dirname, '..', 'uploads', 'confirmaciones_aes');
    try { fs.mkdirSync(localDir, { recursive: true }); } catch (_) {}
    return localDir;
})();

let schemaReadyPromise = null;

function ensureAesConfirmationsSchema() {
    if (schemaReadyPromise) return schemaReadyPromise;
    schemaReadyPromise = (async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS aes_load_confirmations (
                    id SERIAL PRIMARY KEY,
                    batch_id TEXT,
                    expediente_id INTEGER,
                    expediente_code TEXT,
                    subserie TEXT,
                    ficha TEXT,
                    titular_nombre TEXT,
                    titular_documento TEXT,
                    document_id INTEGER UNIQUE,
                    filename TEXT,
                    typology_name TEXT,
                    onbase_name TEXT,
                    page_count INTEGER,
                    bot_key TEXT,
                    onbase_user TEXT,
                    operator_user_name TEXT,
                    started_at TIMESTAMPTZ,
                    confirmed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    duration_ms INTEGER,
                    expediente_docs_loaded INTEGER DEFAULT 0,
                    expediente_docs_total INTEGER DEFAULT 0,
                    expediente_completed BOOLEAN DEFAULT FALSE,
                    expediente_completed_at TIMESTAMPTZ,
                    source_mode TEXT DEFAULT 'BOT_ONBASE',
                    attempt_count INTEGER DEFAULT 1
                )
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_aes_conf_confirmed_at ON aes_load_confirmations (confirmed_at DESC)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_aes_conf_exp_id ON aes_load_confirmations (expediente_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_aes_conf_batch_id ON aes_load_confirmations (batch_id)');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS aes_email_reports_log (
                    id SERIAL PRIMARY KEY,
                    batch_id TEXT,
                    recipient_email TEXT,
                    subject TEXT,
                    total_expedientes INTEGER DEFAULT 0,
                    total_documents INTEGER DEFAULT 0,
                    excel_path TEXT,
                    delivery_channel TEXT,
                    delivery_status TEXT,
                    error_message TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Default settings in system_settings if missing
            await pool.query(`
                INSERT INTO system_settings (key, value)
                VALUES ('aes_confirmation_email', $1)
                ON CONFLICT (key) DO NOTHING
            `, [DEFAULT_RECIPIENT_EMAIL]);
            await pool.query(`
                INSERT INTO system_settings (key, value)
                VALUES ('aes_auto_email_on_batch_end', 'true')
                ON CONFLICT (key) DO NOTHING
            `);

            // Backfill existing Cargado documents that are not yet in aes_load_confirmations
            await pool.query(`
                INSERT INTO aes_load_confirmations (
                    batch_id, expediente_id, expediente_code, subserie, ficha,
                    titular_nombre, titular_documento, document_id, filename,
                    typology_name, page_count, bot_key, onbase_user,
                    started_at, confirmed_at, duration_ms, source_mode
                )
                SELECT
                    'HISTORICO-INICIAL',
                    d.expediente_id,
                    COALESCE(e.expediente_code, ''),
                    COALESCE(e.subserie, ''),
                    COALESCE((e.metadata_values::jsonb ->> 'valor4'), (e.metadata_values::jsonb ->> 'ficha'), ''),
                    COALESCE(NULLIF(e.title, ''), (e.metadata_values::jsonb ->> 'valor7'), (e.metadata_values::jsonb ->> 'valor6'), ''),
                    COALESCE((e.metadata_values::jsonb ->> 'valor6'), (e.metadata_values::jsonb ->> 'numero_documento'), ''),
                    d.id,
                    d.filename,
                    d.typology_name,
                    d.page_count,
                    CASE
                        WHEN e.subserie LIKE '%9224.4%' OR d.organization_id = 8 THEN '9224.4'
                        WHEN e.subserie LIKE '%9224.2%' OR d.organization_id = 7 THEN '9224.2'
                        ELSE '9224'
                    END,
                    CASE
                        WHEN e.subserie LIKE '%9224.4%' OR d.organization_id = 8 THEN 'EDHERNANDEZM'
                        WHEN e.subserie LIKE '%9224.2%' OR d.organization_id = 7 THEN 'luepitar'
                        ELSE 'TVILLAMIZARJ'
                    END,
                    COALESCE(NULLIF(d.load_date::text, '')::timestamptz, d.created_at, CURRENT_TIMESTAMP),
                    COALESCE(NULLIF(d.load_date::text, '')::timestamptz, d.created_at, CURRENT_TIMESTAMP),
                    0,
                    'HISTORICO_BD'
                FROM documents d
                LEFT JOIN expedientes e ON e.id = d.expediente_id
                WHERE d.status = 'Cargado'
                  AND NOT EXISTS (SELECT 1 FROM aes_load_confirmations c WHERE c.document_id = d.id)
                ON CONFLICT (document_id) DO NOTHING
            `).catch(err => console.warn('[AES-CONFIRMATIONS] Backfill warning:', err.message));

            // Refresh expediente_docs_loaded / total / completed flags for backfilled expedientes
            await pool.query(`
                WITH exp_stats AS (
                    SELECT
                        d.expediente_id,
                        COUNT(*) AS total_docs,
                        COUNT(*) FILTER (WHERE d.status = 'Cargado') AS loaded_docs,
                        MAX(COALESCE(NULLIF(d.load_date::text, '')::timestamptz, CURRENT_TIMESTAMP)) AS max_loaded_at
                    FROM documents d
                    WHERE d.expediente_id IS NOT NULL
                    GROUP BY d.expediente_id
                )
                UPDATE aes_load_confirmations c
                SET expediente_docs_total = s.total_docs,
                    expediente_docs_loaded = s.loaded_docs,
                    expediente_completed = (s.loaded_docs >= s.total_docs AND s.total_docs > 0),
                    expediente_completed_at = CASE
                        WHEN s.loaded_docs >= s.total_docs AND s.total_docs > 0 THEN COALESCE(c.expediente_completed_at, s.max_loaded_at)
                        ELSE NULL
                    END
                FROM exp_stats s
                WHERE c.expediente_id = s.expediente_id
                  AND (c.expediente_docs_total = 0 OR c.expediente_docs_loaded != s.loaded_docs)
            `).catch(() => {});

            console.log('[AES-CONFIRMATIONS] Schema & historical backfill verified.');
        } catch (err) {
            console.error('[AES-CONFIRMATIONS] Error ensuring schema:', err.message);
        }
    })();
    return schemaReadyPromise;
}

ensureAesConfirmationsSchema();

function parseMetaSafe(metaRaw) {
    if (!metaRaw) return {};
    if (typeof metaRaw === 'object') return metaRaw;
    try {
        const p = JSON.parse(metaRaw);
        return typeof p === 'string' ? JSON.parse(p) : (p || {});
    } catch (_) {
        return {};
    }
}

function formatBogotaDateTime(dt) {
    if (!dt) return '';
    try {
        const d = new Date(dt);
        if (isNaN(d.getTime())) return String(dt);
        return d.toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (_) {
        return String(dt);
    }
}

/**
 * Registra en tiempo real la confirmación exacta de cargue de un documento y actualiza el cierre del expediente.
 */
async function recordAesDocConfirmation({
    documentId,
    batchId = null,
    botKey = null,
    onbaseUser = null,
    operatorName = null,
    startedAt = null,
    confirmedAt = null,
    sourceMode = 'BOT_ONBASE'
}) {
    if (!documentId) return null;
    try {
        await ensureAesConfirmationsSchema();
        const docRes = await pool.query(`
            SELECT d.id, d.expediente_id, d.filename, d.typology_name, d.page_count, d.organization_id,
                   e.expediente_code, e.subserie, e.title, e.metadata_values
            FROM documents d
            LEFT JOIN expedientes e ON e.id = d.expediente_id
            WHERE d.id = $1
            LIMIT 1
        `, [documentId]);

        if (!docRes.rows || docRes.rows.length === 0) return null;
        const row = docRes.rows[0];
        const meta = parseMetaSafe(row.metadata_values);

        const sub = String(row.subserie || '').trim();
        let ficha = '';
        let titularNombre = String(row.title || '').trim();
        let titularDoc = '';

        if (sub.includes('9224.4-37') || sub.endsWith('-37')) {
            ficha = String(meta.valor4 || meta.ficha || '').trim();
            const v6 = String(meta.valor6 || '').trim();
            const v7 = String(meta.valor7 || '').trim();
            if (/^\d+$/.test(v6)) {
                titularDoc = v6;
                titularNombre = v7 || titularNombre;
            } else if (/^\d+$/.test(v7)) {
                titularDoc = v7;
                titularNombre = v6 || titularNombre;
            } else {
                titularDoc = String(meta.numero_documento || meta.valor5 || '').trim();
                titularNombre = v6 || v7 || titularNombre;
            }
        } else if (sub.includes('22.10') || sub.includes('22.')) {
            ficha = String(meta.valor1 || '').trim(); // Contrato SECOP
            titularNombre = String(meta.valor4 || titularNombre).trim();
            titularDoc = String(meta.valor5 || '').trim();
        } else {
            ficha = String(meta.radicado || meta.valor1 || '').trim();
            titularNombre = String(meta.peticionario || meta.valor2 || titularNombre).trim();
        }

        const nowDate = confirmedAt ? new Date(confirmedAt) : new Date();
        const startDate = startedAt ? new Date(startedAt) : nowDate;
        const durationMs = Math.max(0, nowDate.getTime() - startDate.getTime());

        const resolvedBotKey = botKey || (
            sub.includes('9224.4') || row.organization_id === 8 ? '9224.4' :
            sub.includes('9224.2') || row.organization_id === 7 ? '9224.2' : '9224'
        );
        const resolvedOnbaseUser = onbaseUser || (
            resolvedBotKey === '9224.4' ? 'EDHERNANDEZM' :
            resolvedBotKey === '9224.2' ? 'luepitar' : 'TVILLAMIZARJ'
        );

        let expTotal = 1;
        let expLoaded = 1;
        let expCompleted = true;

        if (row.expediente_id) {
            const cntRes = await pool.query(`
                SELECT
                    COUNT(*)::int AS total_docs,
                    COUNT(*) FILTER (WHERE status = 'Cargado' OR id = $2)::int AS loaded_docs
                FROM documents
                WHERE expediente_id = $1
            `, [row.expediente_id, documentId]);
            expTotal = cntRes.rows?.[0]?.total_docs || 1;
            expLoaded = cntRes.rows?.[0]?.loaded_docs || 1;
            expCompleted = expLoaded >= expTotal && expTotal > 0;
        }

        const upsertRes = await pool.query(`
            INSERT INTO aes_load_confirmations (
                batch_id, expediente_id, expediente_code, subserie, ficha,
                titular_nombre, titular_documento, document_id, filename,
                typology_name, page_count, bot_key, onbase_user, operator_user_name,
                started_at, confirmed_at, duration_ms,
                expediente_docs_loaded, expediente_docs_total,
                expediente_completed, expediente_completed_at, source_mode, attempt_count
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13, $14,
                $15, $16, $17,
                $18, $19,
                $20, $21, $22, 1
            )
            ON CONFLICT (document_id) DO UPDATE SET
                batch_id = COALESCE(EXCLUDED.batch_id, aes_load_confirmations.batch_id),
                expediente_code = EXCLUDED.expediente_code,
                subserie = EXCLUDED.subserie,
                ficha = EXCLUDED.ficha,
                titular_nombre = EXCLUDED.titular_nombre,
                titular_documento = EXCLUDED.titular_documento,
                bot_key = EXCLUDED.bot_key,
                onbase_user = EXCLUDED.onbase_user,
                operator_user_name = COALESCE(EXCLUDED.operator_user_name, aes_load_confirmations.operator_user_name),
                started_at = EXCLUDED.started_at,
                confirmed_at = EXCLUDED.confirmed_at,
                duration_ms = EXCLUDED.duration_ms,
                expediente_docs_loaded = EXCLUDED.expediente_docs_loaded,
                expediente_docs_total = EXCLUDED.expediente_docs_total,
                expediente_completed = EXCLUDED.expediente_completed,
                expediente_completed_at = CASE
                    WHEN EXCLUDED.expediente_completed THEN EXCLUDED.confirmed_at
                    ELSE NULL
                END,
                source_mode = EXCLUDED.source_mode,
                attempt_count = aes_load_confirmations.attempt_count + 1
            RETURNING *
        `, [
            batchId || `BATCH-${nowDate.toISOString().slice(0, 10)}`,
            row.expediente_id || null,
            String(row.expediente_code || '').trim(),
            sub,
            ficha,
            titularNombre,
            titularDoc,
            documentId,
            row.filename,
            row.typology_name,
            row.page_count || null,
            resolvedBotKey,
            resolvedOnbaseUser,
            operatorName || null,
            startDate.toISOString(),
            nowDate.toISOString(),
            durationMs,
            expLoaded,
            expTotal,
            expCompleted,
            expCompleted ? nowDate.toISOString() : null,
            sourceMode
        ]);

        // Synchronize sibling documents of the same expediente so all share the updated expediente completion state
        if (row.expediente_id) {
            await pool.query(`
                UPDATE aes_load_confirmations
                SET expediente_docs_loaded = $2,
                    expediente_docs_total = $3,
                    expediente_completed = $4,
                    expediente_completed_at = CASE WHEN $4 THEN $5::timestamptz ELSE NULL END,
                    expediente_code = COALESCE(NULLIF($6, ''), expediente_code)
                WHERE expediente_id = $1
            `, [
                row.expediente_id,
                expLoaded,
                expTotal,
                expCompleted,
                nowDate.toISOString(),
                String(row.expediente_code || '').trim()
            ]);
        }

        return upsertRes.rows?.[0] || null;
    } catch (err) {
        console.error('[AES-CONFIRMATIONS] recordAesDocConfirmation error:', err.message);
        return null;
    }
}

/**
 * Construye los datos filtrados (expedientes agrupados + documentos + KPIs)
 */
async function queryConfirmationData(filters = {}) {
    await ensureAesConfirmationsSchema();
    const {
        date_from,
        date_to,
        subserie,
        bot_key,
        batch_id,
        only_completed,
        search,
        limit = 5000
    } = filters;

    const conds = [];
    const params = [];

    if (batch_id) {
        params.push(String(batch_id).trim());
        conds.push(`c.batch_id = $${params.length}`);
    }
    if (date_from) {
        params.push(String(date_from).trim());
        conds.push(`(c.confirmed_at AT TIME ZONE 'America/Bogota')::date >= $${params.length}::date`);
    }
    if (date_to) {
        params.push(String(date_to).trim());
        conds.push(`(c.confirmed_at AT TIME ZONE 'America/Bogota')::date <= $${params.length}::date`);
    }
    if (subserie && subserie !== 'all') {
        params.push(`%${String(subserie).trim()}%`);
        conds.push(`c.subserie ILIKE $${params.length}`);
    }
    if (bot_key && bot_key !== 'all') {
        params.push(String(bot_key).trim());
        conds.push(`c.bot_key = $${params.length}`);
    }
    if (only_completed === 'true' || only_completed === true) {
        conds.push(`c.expediente_completed = TRUE`);
    }
    if (search && String(search).trim() !== '') {
        params.push(`%${String(search).trim()}%`);
        const p = `$${params.length}`;
        conds.push(`(
            COALESCE(c.expediente_code, '') ILIKE ${p}
            OR COALESCE(c.titular_nombre, '') ILIKE ${p}
            OR COALESCE(c.titular_documento, '') ILIKE ${p}
            OR COALESCE(c.ficha, '') ILIKE ${p}
            OR COALESCE(c.filename, '') ILIKE ${p}
            OR COALESCE(c.typology_name, '') ILIKE ${p}
        )`);
    }

    const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const safeLimit = Math.min(25000, Math.max(50, parseInt(limit, 10) || 5000));
    params.push(safeLimit);

    const res = await pool.query(`
        SELECT c.*,
               COALESCE(NULLIF(e.expediente_code, ''), c.expediente_code) AS live_exp_code
        FROM aes_load_confirmations c
        LEFT JOIN expedientes e ON e.id = c.expediente_id
        ${whereSql}
        ORDER BY c.confirmed_at DESC, c.id DESC
        LIMIT $${params.length}
    `, params);

    const docs = (res.rows || []).map(r => ({
        ...r,
        expediente_code: r.live_exp_code || r.expediente_code || 'SIN-CODIGO',
        started_at_bogota: formatBogotaDateTime(r.started_at),
        confirmed_at_bogota: formatBogotaDateTime(r.confirmed_at),
        expediente_completed_at_bogota: formatBogotaDateTime(r.expediente_completed_at)
    }));

    // Group by expediente
    const expMap = new Map();
    for (const d of docs) {
        const key = d.expediente_id ? `EXP_${d.expediente_id}` : `DOC_${d.document_id}`;
        if (!expMap.has(key)) {
            expMap.set(key, {
                key,
                expediente_id: d.expediente_id,
                expediente_code: d.expediente_code,
                subserie: d.subserie,
                ficha: d.ficha,
                titular_nombre: d.titular_nombre,
                titular_documento: d.titular_documento,
                bot_key: d.bot_key,
                onbase_user: d.onbase_user,
                docs_loaded: d.expediente_docs_loaded || 1,
                docs_total: d.expediente_docs_total || 1,
                expediente_completed: Boolean(d.expediente_completed),
                first_started_at: d.started_at,
                last_confirmed_at: d.confirmed_at,
                expediente_completed_at: d.expediente_completed_at || (d.expediente_completed ? d.confirmed_at : null),
                total_folios: 0,
                documents: []
            });
        }
        const grp = expMap.get(key);
        if (d.started_at && (!grp.first_started_at || new Date(d.started_at) < new Date(grp.first_started_at))) {
            grp.first_started_at = d.started_at;
        }
        if (d.confirmed_at && (!grp.last_confirmed_at || new Date(d.confirmed_at) > new Date(grp.last_confirmed_at))) {
            grp.last_confirmed_at = d.confirmed_at;
        }
        grp.total_folios += Number(d.page_count || 0);
        grp.documents.push(d);
    }

    const expedientes = Array.from(expMap.values()).map(g => {
        g.documents.sort((a, b) => new Date(a.confirmed_at) - new Date(b.confirmed_at));
        return {
            ...g,
            first_started_at_bogota: formatBogotaDateTime(g.first_started_at),
            last_confirmed_at_bogota: formatBogotaDateTime(g.last_confirmed_at),
            expediente_completed_at_bogota: formatBogotaDateTime(g.expediente_completed_at)
        };
    });

    // Global KPIs for today (Bogota timezone)
    const kpiRes = await pool.query(`
        SELECT
            COUNT(*)::int AS total_docs_confirmed,
            COUNT(DISTINCT expediente_id)::int AS total_expedientes_touched,
            COUNT(DISTINCT expediente_id) FILTER (WHERE expediente_completed = TRUE)::int AS total_expedientes_completed,
            COUNT(*) FILTER (
                WHERE (confirmed_at AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
            )::int AS docs_today,
            COUNT(DISTINCT expediente_id) FILTER (
                WHERE (confirmed_at AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
            )::int AS expedientes_today,
            MAX(confirmed_at) AS last_confirmed_at
        FROM aes_load_confirmations
    `);
    const kpiRow = kpiRes.rows?.[0] || {};

    return {
        kpis: {
            total_docs_confirmed: kpiRow.total_docs_confirmed || 0,
            total_expedientes_touched: kpiRow.total_expedientes_touched || 0,
            total_expedientes_completed: kpiRow.total_expedientes_completed || 0,
            docs_today: kpiRow.docs_today || 0,
            expedientes_today: kpiRow.expedientes_today || 0,
            last_confirmed_at_bogota: formatBogotaDateTime(kpiRow.last_confirmed_at)
        },
        expedientes,
        documents: docs
    };
}

/**
 * Construye un archivo Excel (.xlsx) en Buffer con 2 hojas:
 * 1) Resumen Expedientes (Hora Inicio y Hora Exacta Cierre)
 * 2) Detalle Documentos (Hora Exacta de cada PDF)
 */
function buildConfirmationExcelBuffer(data) {
    const wb = xlsx.utils.book_new();

    const expRows = (data.expedientes || []).map((e, idx) => ({
        '#': idx + 1,
        'Código Expediente AES': e.expediente_code || 'SIN-CODIGO',
        'Estado Expediente': e.expediente_completed ? 'COMPLETADO 100%' : `PARCIAL (${e.docs_loaded}/${e.docs_total})`,
        'Docs Cargados': e.docs_loaded,
        'Docs Totales': e.docs_total,
        'Total Folios': e.total_folios || '',
        'Hora Inicio Cargue (Colombia)': e.first_started_at_bogota || '',
        'Hora Exacta Confirmación Final (Colombia)': e.expediente_completed_at_bogota || e.last_confirmed_at_bogota || '',
        'Subserie TRD': e.subserie || '',
        'Ficha / Contrato / Radicado': e.ficha || '',
        'Documento Titular': e.titular_documento || '',
        'Nombre Aprendiz / Titular': e.titular_nombre || '',
        'Usuario OnBase': e.onbase_user || '',
        'Bot': e.bot_key || ''
    }));

    const docRows = (data.documents || []).map((d, idx) => ({
        '#': idx + 1,
        'Código Expediente AES': d.expediente_code || 'SIN-CODIGO',
        'ID Doc BD': d.document_id,
        'Archivo PDF': d.filename || '',
        'Tipología Documental TRD': d.typology_name || '',
        'Folios': d.page_count || '',
        'Hora Inicio Envío (Colombia)': d.started_at_bogota || '',
        'Hora Exacta Confirmación OnBase (Colombia)': d.confirmed_at_bogota || '',
        'Duración (seg)': d.duration_ms ? (d.duration_ms / 1000).toFixed(1) : '0.0',
        'Estado Cierre Expediente': d.expediente_completed ? `COMPLETO (${d.expediente_docs_loaded}/${d.expediente_docs_total})` : `EN PROCESO (${d.expediente_docs_loaded}/${d.expediente_docs_total})`,
        'Subserie TRD': d.subserie || '',
        'Ficha / Radicado': d.ficha || '',
        'Documento Titular': d.titular_documento || '',
        'Nombre Titular': d.titular_nombre || '',
        'Usuario OnBase': d.onbase_user || '',
        'Lote (Batch)': d.batch_id || ''
    }));

    const wsExp = xlsx.utils.json_to_sheet(expRows.length ? expRows : [{ Mensaje: 'Sin registros para el filtro seleccionado' }]);
    const wsDocs = xlsx.utils.json_to_sheet(docRows.length ? docRows : [{ Mensaje: 'Sin documentos para el filtro seleccionado' }]);

    wsExp['!cols'] = [
        { wch: 6 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 13 }, { wch: 12 },
        { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 10 }
    ];
    wsDocs['!cols'] = [
        { wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 38 }, { wch: 44 }, { wch: 8 },
        { wch: 26 }, { wch: 30 }, { wch: 13 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 22 }
    ];

    xlsx.utils.book_append_sheet(wb, wsExp, 'Confirmacion Expedientes');
    xlsx.utils.book_append_sheet(wb, wsDocs, 'Confirmacion Documentos');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Envía el resumen y Excel adjunto al correo configurado (por defecto leparadam@sena.edu.co)
 * Soporta SMTP (nodemailer) + Sesión activa Outlook 365 Web (OWA) + respaldo local en /mnt/almacen/confirmaciones_aes
 */
async function sendAesBatchSummaryEmail({
    batchId = null,
    date_from = null,
    date_to = null,
    recipientEmail = null,
    botKey = null,
    onbaseUser = null,
    isAutoBatchEnd = false
} = {}) {
    await ensureAesConfirmationsSchema();

    // Check settings
    const setRes = await pool.query(`
        SELECT key, value FROM system_settings
        WHERE key IN ('aes_confirmation_email', 'aes_auto_email_on_batch_end', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass')
    `);
    const cfg = {};
    (setRes.rows || []).forEach(r => { cfg[r.key] = r.value; });

    if (isAutoBatchEnd && String(cfg.aes_auto_email_on_batch_end || 'true') === 'false') {
        return { skipped: true, reason: 'Envío automático desactivado en configuración.' };
    }

    const toEmail = String(recipientEmail || cfg.aes_confirmation_email || DEFAULT_RECIPIENT_EMAIL).trim() || DEFAULT_RECIPIENT_EMAIL;
    const data = await queryConfirmationData({
        batch_id: batchId || undefined,
        date_from: !batchId ? (date_from || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })) : undefined,
        date_to: !batchId ? (date_to || undefined) : undefined,
        bot_key: botKey || undefined,
        limit: 10000
    });

    const totalExps = data.expedientes.length;
    const completedExps = data.expedientes.filter(e => e.expediente_completed).length;
    const totalDocs = data.documents.length;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const excelFilename = `Acta_Confirmacion_Cargue_AES_${stamp}.xlsx`;
    const excelPath = path.join(REPORTS_DIR, excelFilename);
    const excelBuffer = buildConfirmationExcelBuffer(data);
    fs.writeFileSync(excelPath, excelBuffer);

    const nowBogota = formatBogotaDateTime(new Date());
    const subject = `✅ Confirmación Cargue AES OnBase (${totalExps} Expedientes / ${totalDocs} Documentos) - ${nowBogota}`;

    const topRowsHtml = data.expedientes.slice(0, 25).map(e => `
        <tr>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;">${e.expediente_code}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${e.subserie || ''}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${e.ficha || ''} - ${e.titular_nombre || ''}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:center;">${e.docs_loaded}/${e.docs_total}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#15803d;font-weight:bold;">${e.expediente_completed_at_bogota || e.last_confirmed_at_bogota}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;">${e.onbase_user || ''}</td>
        </tr>
    `).join('');

    const htmlBody = `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:900px;">
            <div style="background:#00324d;color:#ffffff;padding:16px 22px;border-radius:8px 8px 0 0;border-bottom:4px solid #39a900;">
                <h2 style="margin:0;font-size:18px;">SENA CIMI · Bitácora Oficial de Confirmación de Cargue AES (OnBase)</h2>
                <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Fecha de emisión (Colombia): ${nowBogota} ${batchId ? `| Lote: ${batchId}` : ''}</p>
            </div>
            <div style="padding:18px 22px;border:1px solid #e2e8f0;border-top:none;background:#ffffff;">
                <p style="margin-top:0;">Se adjunta el reporte detallado en Excel (<strong>${excelFilename}</strong>) con la hora exacta de cargue de cada expediente y cada documento PDF en OnBase.</p>
                <div style="display:flex;gap:16px;margin:14px 0;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div><strong>Expedientes procesados:</strong> ${totalExps} (${completedExps} al 100%)</div>
                    <div style="margin-left:18px;"><strong>Documentos PDF confirmados:</strong> ${totalDocs}</div>
                    ${onbaseUser ? `<div style="margin-left:18px;"><strong>Cuenta OnBase:</strong> ${onbaseUser}</div>` : ''}
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
                    <thead>
                        <tr style="background:#f1f5f9;color:#0f172a;">
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:left;">Expediente AES</th>
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:left;">Subserie</th>
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:left;">Ficha / Titular</th>
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">Docs</th>
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:left;">Hora Confirmación</th>
                            <th style="padding:8px 10px;border:1px solid #cbd5e1;text-align:left;">Usuario OnBase</th>
                        </tr>
                    </thead>
                    <tbody>${topRowsHtml}</tbody>
                </table>
                ${totalExps > 25 ? `<p style="font-size:11px;color:#64748b;margin-top:8px;">Mostrando los primeros 25 de ${totalExps} expedientes. Consulte el archivo Excel adjunto para el listado completo.</p>` : ''}
            </div>
        </div>
    `;

    let channelUsed = 'GUARDADO_EN_SERVIDOR';
    let deliveryStatus = 'PENDIENTE_CONFIG_CORREO';
    let lastError = null;

    // 1. Try SMTP (Nodemailer) if configured
    const smtpUser = cfg.smtp_user || process.env.SMTP_USER;
    const smtpPass = cfg.smtp_pass || process.env.SMTP_PASS;
    if (nodemailer && smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: cfg.smtp_host || process.env.SMTP_HOST || 'smtp.office365.com',
                port: parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587', 10),
                secure: false,
                auth: { user: smtpUser, pass: smtpPass }
            });
            await transporter.sendMail({
                from: smtpUser,
                to: toEmail,
                subject,
                html: htmlBody,
                attachments: [{ filename: excelFilename, content: excelBuffer }]
            });
            channelUsed = 'SMTP_OFFICE365';
            deliveryStatus = 'ENVIADO';
        } catch (smtpErr) {
            lastError = `SMTP: ${smtpErr.message}`;
        }
    }

    // 2. Fallback: Try active Outlook 365 Web session if open in Historias / Deserciones Sync Controller
    if (deliveryStatus !== 'ENVIADO') {
        try {
            const historiasCtrl = require('../controllers/historiasAcademicasCorreoController');
            if (historiasCtrl && typeof historiasCtrl.sendEmailViaOutlookWeb === 'function') {
                const owaRes = await historiasCtrl.sendEmailViaOutlookWeb({
                    to: toEmail,
                    subject,
                    htmlBody,
                    attachmentPath: excelPath
                });
                if (owaRes && owaRes.sent) {
                    channelUsed = 'OUTLOOK_365_WEB_ACTIVO';
                    deliveryStatus = 'ENVIADO';
                    lastError = null;
                } else if (owaRes && owaRes.reason) {
                    lastError = lastError ? `${lastError} | OWA: ${owaRes.reason}` : `OWA: ${owaRes.reason}`;
                }
            }
        } catch (_) {}
    }

    await pool.query(`
        INSERT INTO aes_email_reports_log (
            batch_id, recipient_email, subject, total_expedientes, total_documents,
            excel_path, delivery_channel, delivery_status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        batchId || null,
        toEmail,
        subject,
        totalExps,
        totalDocs,
        excelPath,
        channelUsed,
        deliveryStatus,
        lastError
    ]).catch(() => {});

    return {
        success: deliveryStatus === 'ENVIADO',
        delivery_status: deliveryStatus,
        delivery_channel: channelUsed,
        recipient_email: toEmail,
        total_expedientes: totalExps,
        total_documents: totalDocs,
        excel_filename: excelFilename,
        excel_path: excelPath,
        warning: lastError
    };
}

// ─── ENDPOINTS HTTP (/api/aes-confirmations) ─────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await queryConfirmationData(req.query || {});
        const logsRes = await pool.query(`
            SELECT id, batch_id, recipient_email, subject, total_expedientes, total_documents,
                   delivery_channel, delivery_status, error_message, created_at
            FROM aes_email_reports_log
            ORDER BY id DESC
            LIMIT 15
        `);
        res.json({
            success: true,
            ...data,
            email_logs: (logsRes.rows || []).map(l => ({
                ...l,
                created_at_bogota: formatBogotaDateTime(l.created_at)
            }))
        });
    } catch (err) {
        console.error('[AES-CONFIRMATIONS] GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/export-excel', requireAuth, async (req, res) => {
    try {
        const data = await queryConfirmationData({ ...(req.query || {}), limit: 25000 });
        const buffer = buildConfirmationExcelBuffer(data);
        const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Confirmacion_Cargue_AES_${dateStr}.xlsx"`);
        res.send(buffer);
    } catch (err) {
        console.error('[AES-CONFIRMATIONS] export-excel error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/settings', requireAuth, async (req, res) => {
    try {
        await ensureAesConfirmationsSchema();
        const r = await pool.query(`
            SELECT key, value FROM system_settings
            WHERE key IN ('aes_confirmation_email', 'aes_auto_email_on_batch_end', 'smtp_host', 'smtp_port', 'smtp_user')
        `);
        const map = {
            aes_confirmation_email: DEFAULT_RECIPIENT_EMAIL,
            aes_auto_email_on_batch_end: 'true',
            smtp_host: 'smtp.office365.com',
            smtp_port: '587',
            smtp_user: ''
        };
        (r.rows || []).forEach(row => { map[row.key] = row.value; });
        res.json({ success: true, settings: map });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings', requireAuth, async (req, res) => {
    try {
        await ensureAesConfirmationsSchema();
        const {
            aes_confirmation_email,
            aes_auto_email_on_batch_end,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass
        } = req.body || {};

        const pairs = [
            ['aes_confirmation_email', String(aes_confirmation_email || DEFAULT_RECIPIENT_EMAIL).trim()],
            ['aes_auto_email_on_batch_end', String(aes_auto_email_on_batch_end ?? 'true')],
            ['smtp_host', String(smtp_host || 'smtp.office365.com').trim()],
            ['smtp_port', String(smtp_port || '587').trim()],
            ['smtp_user', String(smtp_user || '').trim()]
        ];
        if (smtp_pass && String(smtp_pass).trim() !== '') {
            pairs.push(['smtp_pass', String(smtp_pass).trim()]);
        }

        for (const [k, v] of pairs) {
            await pool.query(
                `INSERT INTO system_settings (key, value, updated_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                [k, v]
            );
        }
        res.json({ success: true, message: 'Configuración de confirmación y correo guardada correctamente.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/send-email', requireAuth, async (req, res) => {
    try {
        const result = await sendAesBatchSummaryEmail({
            batchId: req.body?.batch_id || null,
            date_from: req.body?.date_from || null,
            date_to: req.body?.date_to || null,
            recipientEmail: req.body?.recipient_email || null,
            botKey: req.body?.bot_key || null,
            isAutoBatchEnd: false
        });
        res.json(result);
    } catch (err) {
        console.error('[AES-CONFIRMATIONS] send-email error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.recordAesDocConfirmation = recordAesDocConfirmation;
module.exports.sendAesBatchSummaryEmail = sendAesBatchSummaryEmail;
module.exports.ensureAesConfirmationsSchema = ensureAesConfirmationsSchema;
