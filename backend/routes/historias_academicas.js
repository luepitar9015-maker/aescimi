const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../database_pg');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/historiasAcademicasCorreoController');

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (_) {}

const uploadDir = path.join(ctrl.INBOX_STORAGE_DIR, 'uploads_manual');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const safe = String(file.originalname || 'archivo').replace(/[^a-zA-Z0-9._ -]/g, '_');
            cb(null, `${Date.now()}_${safe}`);
        }
    })
});

function checkDiskFileExists(docPath, filename) {
    if (!docPath) return false;
    const p = String(docPath).replace(/\\/g, '/');
    if (fs.existsSync(p)) return true;
    for (const v of [
        p.replace('/mnt/almacen/689224/', '/mnt/almacen/9224/'),
        p.replace('/689224/', '/9224/')
    ]) {
        if (fs.existsSync(v)) return true;
    }
    if (filename && fs.existsSync(path.join(__dirname, '..', 'uploads', filename))) return true;
    return false;
}

// 1. Catálogo oficial de las 36 Tipologías de Historias Académicas (68.9224.4-37)
router.get('/typologies', requireAuth, async (_req, res) => {
    try {
        const rows = await ctrl.getOfficial37Typologies();
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Listado y Auditoría de Historias Académicas registradas en BD (con filtros y KPIs)
router.get('/expedientes', requireAuth, async (req, res) => {
    try {
        const {
            search = '',
            ficha = '',
            code_filter = 'all',     // all | con_codigo | sin_codigo
            docs_filter = 'all',     // all | con_docs | sin_docs
            assigned_user_id = 'all',
            only_mine = 'false',
            limit = 150,
            offset = 0
        } = req.query || {};

        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
        const conds = [`(e.subserie = '68.9224.4-37' OR e.subserie LIKE '%9224.4-37%')`];
        const params = [];

        if (ficha && ficha !== 'all') {
            params.push(String(ficha).trim());
            conds.push(`(e.metadata_values::text ILIKE '%"' || $${params.length} || '"%')`);
        }
        if (code_filter === 'con_codigo') {
            conds.push(`(e.expediente_code IS NOT NULL AND TRIM(e.expediente_code) != '')`);
        } else if (code_filter === 'sin_codigo') {
            conds.push(`(e.expediente_code IS NULL OR TRIM(e.expediente_code) = '')`);
        }
        if (docs_filter === 'con_docs') {
            conds.push(`EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id)`);
        } else if (docs_filter === 'sin_docs') {
            conds.push(`NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id)`);
        }
        if (only_mine === 'true' && req.user?.id) {
            params.push(Number(req.user.id));
            conds.push(`EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = e.id AND ea.user_id = $${params.length})`);
        } else if (assigned_user_id && assigned_user_id !== 'all') {
            if (assigned_user_id === 'unassigned') {
                conds.push(`NOT EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = e.id)`);
            } else {
                params.push(Number(assigned_user_id));
                conds.push(`EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = e.id AND ea.user_id = $${params.length})`);
            }
        }
        if (search && String(search).trim() !== '') {
            params.push(`%${String(search).trim()}%`);
            const p = `$${params.length}`;
            conds.push(`(
                COALESCE(e.expediente_code, '') ILIKE ${p}
                OR COALESCE(e.title, '') ILIKE ${p}
                OR COALESCE(e.metadata_values::text, '') ILIKE ${p}
            )`);
        }

        const whereSql = `WHERE ${conds.join(' AND ')}`;
        const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM expedientes e ${whereSql}`, params);
        const totalMatching = countRes.rows?.[0]?.total || 0;

        const safeLimit = Math.min(500, Math.max(20, parseInt(limit, 10) || 150));
        const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
        const listParams = [...params, safeLimit, safeOffset];

        const rowsRes = await pool.query(`
            SELECT e.id, e.expediente_code, e.subserie, e.title, e.opening_date, e.metadata_values,
                   (SELECT COUNT(*)::int FROM documents d WHERE d.expediente_id = e.id) AS docs_count,
                   (SELECT COUNT(*)::int FROM documents d WHERE d.expediente_id = e.id AND d.status = 'Cargado') AS docs_cargado,
                   (SELECT COUNT(*)::int FROM documents d WHERE d.expediente_id = e.id AND d.status = 'Pendiente') AS docs_pendiente,
                   (SELECT string_agg(u.full_name, ', ')
                    FROM expediente_assignments ea JOIN users u ON u.id = ea.user_id
                    WHERE ea.expediente_id = e.id) AS assigned_names
            FROM expedientes e
            ${whereSql}
            ORDER BY
                CASE WHEN e.expediente_code IS NOT NULL AND TRIM(e.expediente_code) != '' THEN 0 ELSE 1 END,
                e.id DESC
            LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `, listParams);

        const parsedRows = (rowsRes.rows || []).map(r => ({
            ...ctrl.parseExp37Meta(r),
            opening_date: r.opening_date ? String(r.opening_date).slice(0, 10) : '',
            docs_cargado: r.docs_cargado || 0,
            docs_pendiente: r.docs_pendiente || 0,
            assigned_names: r.assigned_names || ''
        }));

        // Global summary KPIs of 68.9224.4-37
        const kpiRes = await pool.query(`
            SELECT
                COUNT(*)::int AS total_historias,
                COUNT(*) FILTER (WHERE expediente_code IS NOT NULL AND TRIM(expediente_code) != '')::int AS con_codigo_aes,
                COUNT(*) FILTER (WHERE expediente_code IS NULL OR TRIM(expediente_code) = '')::int AS sin_codigo_aes,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id))::int AS con_documentos,
                COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id))::int AS sin_documentos
            FROM expedientes e
            WHERE e.subserie = '68.9224.4-37' OR e.subserie LIKE '%9224.4-37%'
        `);

        res.json({
            success: true,
            is_admin: isAdmin,
            total_matching: totalMatching,
            kpis: kpiRes.rows?.[0] || {},
            data: parsedRows
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] GET expedientes error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Detalle de una Historia Académica + Matriz completa contra las 36 Tipologías Oficiales
router.get('/expedientes/:id/detalle', requireAuth, async (req, res) => {
    try {
        const expId = parseInt(req.params.id, 10);
        const [expRes, docsRes, typologies] = await Promise.all([
            pool.query('SELECT * FROM expedientes WHERE id = $1 LIMIT 1', [expId]),
            pool.query('SELECT * FROM documents WHERE expediente_id = $1 ORDER BY filename ASC, id ASC', [expId]),
            ctrl.getOfficial37Typologies()
        ]);

        if (!expRes.rows || expRes.rows.length === 0) {
            return res.status(404).json({ error: 'Historia Académica no encontrada.' });
        }

        const expInfo = ctrl.parseExp37Meta(expRes.rows[0]);
        const docs = (docsRes.rows || []).map(d => ({
            id: d.id,
            filename: d.filename,
            typology_name: d.typology_name,
            status: d.status,
            document_date: d.document_date ? String(d.document_date).slice(0, 10) : '',
            load_date: d.load_date,
            page_count: d.page_count || null,
            disk_ok: checkDiskFileExists(d.path, d.filename),
            path: d.path
        }));

        const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const typologyMatrix = typologies.map(t => {
            const nt = norm(t.typology_name);
            const ntOnbase = norm(t.onbase_name);
            const matchedDocs = docs.filter(d => {
                const nd = norm(d.typology_name);
                return nd && (nd === nt || (ntOnbase && nd === ntOnbase) || nt.includes(nd) || nd.includes(nt.slice(0, 34)));
            });
            return {
                ...t,
                has_documents: matchedDocs.length > 0,
                documents: matchedDocs
            };
        });

        res.json({
            success: true,
            expediente: expInfo,
            documents: docs,
            typology_matrix: typologyMatrix
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Cargar / Convertir archivo o nota directamente a una Tipología de una Historia Académica
router.post('/expedientes/:id/subir-pdf-tipologia', requireAuth, upload.array('files', 10), async (req, res) => {
    try {
        const expId = parseInt(req.params.id, 10);
        const { typology_name, document_date, note_text, subject } = req.body || {};
        if (!typology_name) {
            return res.status(400).json({ error: 'Debe seleccionar una Tipología Documental de Historias Académicas.' });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0 && (!note_text || !String(note_text).trim())) {
            return res.status(400).json({ error: 'Adjunte al menos un archivo (PDF, Imagen o Word) o texto para generar el PDF.' });
        }

        const fakeBandejaItem = {
            subject: subject || typology_name,
            sender_email: req.user?.name || 'Carga Validada en Sistema',
            recipient_emails: 'Expediente Historia Académica',
            email_date: document_date ? new Date(document_date).toISOString() : new Date().toISOString(),
            body_text: note_text || '',
            body_html: '',
            attachments_json: files.map(f => ({ filename: f.originalname, path: f.path }))
        };

        const pdfMode = (files.length > 0 && (!note_text || !String(note_text).trim())) ? 'SOLO_ADJUNTO' : 'UNIFICADO';
        const saved = await ctrl.buildAndAssignHistoriaPdf({
            bandejaItem: fakeBandejaItem,
            expedienteId: expId,
            typologyName: typology_name,
            pdfMode,
            documentDate: document_date || null,
            userId: req.user?.id || null
        });

        res.json({
            success: true,
            message: `PDF guardado y asignado a "${typology_name}" (${saved.page_count} folios).`,
            ...saved
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] subir-pdf-tipologia error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── 5. BANDEJA DE CORREOS SINCRONIZADOS E IMPORTADOS ────────────────────────
router.get('/bandeja', requireAuth, async (req, res) => {
    try {
        await ctrl.ensureHistoriasCorreoSchema();
        const { status = 'Pendiente', search = '' } = req.query || {};
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
        const conds = [];
        const params = [];

        if (status && status !== 'Todos') {
            params.push(status);
            conds.push(`b.verification_status = $${params.length}`);
        }
        if (!isAdmin && req.user?.id) {
            params.push(Number(req.user.id));
            conds.push(`(b.assigned_user_id = $${params.length} OR b.owner_user_id = $${params.length} OR b.assigned_user_id IS NULL)`);
        }
        if (search && String(search).trim() !== '') {
            params.push(`%${String(search).trim()}%`);
            const p = `$${params.length}`;
            conds.push(`(
                COALESCE(b.subject, '') ILIKE ${p}
                OR COALESCE(b.detected_aprendiz_nombre, '') ILIKE ${p}
                OR COALESCE(b.detected_doc_numero, '') ILIKE ${p}
                OR COALESCE(b.detected_ficha, '') ILIKE ${p}
                OR COALESCE(b.radicado, '') ILIKE ${p}
            )`);
        }

        const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const listRes = await pool.query(`
            SELECT b.*,
                   e.expediente_code AS matched_expediente_code,
                   e.title AS matched_expediente_title,
                   u.full_name AS assigned_user_name
            FROM historias_correo_bandeja b
            LEFT JOIN expedientes e ON e.id = b.matched_expediente_id
            LEFT JOIN users u ON u.id = b.assigned_user_id
            ${whereSql}
            ORDER BY b.email_date DESC NULLS LAST, b.id DESC
            LIMIT 400
        `, params);

        res.json({ success: true, data: listRes.rows || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Importar correos (.eml / .pdf / .docx / imágenes) o texto pegado de correo a la bandeja de verificación
router.post('/bandeja/importar', requireAuth, upload.array('files', 30), async (req, res) => {
    try {
        await ctrl.ensureHistoriasCorreoSchema();
        const { raw_email_text = '', mailbox_email = 'leparadam@sena.edu.co' } = req.body || {};
        const files = Array.isArray(req.files) ? req.files : [];

        if (files.length === 0 && !String(raw_email_text || '').trim()) {
            return res.status(400).json({ error: 'Suba uno o varios archivos (.eml, .pdf, .docx, imagen) o pegue el contenido del correo.' });
        }

        const [typologies, historiasIdx] = await Promise.all([
            ctrl.getOfficial37Typologies(),
            ctrl.loadHistoriasIndex()
        ]);

        const createdIds = [];

        // Caso A: archivos .eml individuales vs soportes PDF/DOCX/Imagen
        const emlFiles = files.filter(f => f.originalname.toLowerCase().endsWith('.eml'));
        const supportFiles = files.filter(f => !f.originalname.toLowerCase().endsWith('.eml'));

        for (const ef of emlFiles) {
            const content = fs.readFileSync(ef.path, 'utf8');
            const subj = (content.match(/^Subject:\s*(.+)$/im)?.[1] || ef.originalname).trim();
            const from = (content.match(/^From:\s*(.+)$/im)?.[1] || mailbox_email).trim();
            const to = (content.match(/^To:\s*(.+)$/im)?.[1] || '').trim();
            const plainBody = content.replace(/<[^>]+>/g, ' ').slice(0, 18000);
            const matchInfo = ctrl.matchTextAgainstHistoriasIndex(`${subj}\n${plainBody}`, historiasIdx);
            const typInfo = ctrl.classifyHistoriaTypology(`${subj}\n${plainBody.slice(0, 2500)}`, typologies);
            const uid = `EML-${crypto.createHash('sha256').update(content).digest('hex').slice(0, 24)}`;

            const r = await pool.query(`
                INSERT INTO historias_correo_bandeja (
                    owner_user_id, mailbox_email, folder_name, message_uid,
                    subject, sender_email, recipient_emails, email_date,
                    radicado, nis, body_text, attachments_json,
                    detected_doc_tipo, detected_doc_numero, detected_ficha, detected_aprendiz_nombre,
                    matched_expediente_id, candidate_expedientes_json, match_confidence,
                    suggested_stage, suggested_typology_id, suggested_typology_name, pdf_mode
                ) VALUES (
                    $1,$2,'Importación EML',$3,$4,$5,$6,CURRENT_TIMESTAMP,
                    $7,$8,$9,'[]'::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'SOLO_CORREO'
                )
                ON CONFLICT (message_uid) DO NOTHING
                RETURNING id
            `, [
                req.user?.id || null, mailbox_email, uid, subj, from, to,
                matchInfo.radicado || null, matchInfo.nis || null, plainBody,
                matchInfo.detected_doc_tipo, matchInfo.detected_doc_numero, matchInfo.detected_ficha, matchInfo.detected_aprendiz_nombre,
                matchInfo.matchedExp?.id || null, JSON.stringify(matchInfo.candidates || []), matchInfo.confidence,
                typInfo.stage, typInfo.typology_id, typInfo.typology_name
            ]);
            if (r.rows?.[0]) createdIds.push(r.rows[0].id);
        }

        // Caso B: texto pegado + adjuntos (o cada PDF individual si no hay texto)
        if (String(raw_email_text || '').trim()) {
            const txt = String(raw_email_text).trim();
            const firstLine = txt.split(/\r?\n/).find(l => l.trim().length > 3) || 'Correo importado manualmente';
            let attSnippets = '';
            for (const sf of supportFiles) {
                if (pdfParse && sf.originalname.toLowerCase().endsWith('.pdf')) {
                    try {
                        const pd = await pdfParse(fs.readFileSync(sf.path));
                        attSnippets += `\n${sf.originalname} ${(pd?.text || '').slice(0, 1500)}`;
                    } catch (_) {}
                } else {
                    attSnippets += `\n${sf.originalname}`;
                }
            }
            const combined = `${txt}\n${attSnippets}`;
            const matchInfo = ctrl.matchTextAgainstHistoriasIndex(combined, historiasIdx);
            const typInfo = ctrl.classifyHistoriaTypology(combined.slice(0, 3000), typologies);
            const uid = `TXT-${crypto.createHash('sha256').update(combined + Date.now()).digest('hex').slice(0, 24)}`;
            const mode = supportFiles.length > 0 ? 'UNIFICADO' : 'SOLO_CORREO';

            const r = await pool.query(`
                INSERT INTO historias_correo_bandeja (
                    owner_user_id, mailbox_email, folder_name, message_uid,
                    subject, sender_email, recipient_emails, email_date,
                    radicado, nis, body_text, attachments_json,
                    detected_doc_tipo, detected_doc_numero, detected_ficha, detected_aprendiz_nombre,
                    matched_expediente_id, candidate_expedientes_json, match_confidence,
                    suggested_stage, suggested_typology_id, suggested_typology_name, pdf_mode
                ) VALUES (
                    $1,$2,'Importación Manual',$3,$4,$5,'',CURRENT_TIMESTAMP,
                    $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
                ) RETURNING id
            `, [
                req.user?.id || null, mailbox_email, uid, firstLine.slice(0, 200), mailbox_email,
                matchInfo.radicado || null, matchInfo.nis || null, txt,
                JSON.stringify(supportFiles.map(f => ({ filename: f.originalname, path: f.path }))),
                matchInfo.detected_doc_tipo, matchInfo.detected_doc_numero, matchInfo.detected_ficha, matchInfo.detected_aprendiz_nombre,
                matchInfo.matchedExp?.id || null, JSON.stringify(matchInfo.candidates || []), matchInfo.confidence,
                typInfo.stage, typInfo.typology_id, typInfo.typology_name, mode
            ]);
            if (r.rows?.[0]) createdIds.push(r.rows[0].id);
        } else {
            // Cada archivo PDF/DOCX/Imagen subido sin texto entra como un ítem independiente auto-clasificado
            for (const sf of supportFiles) {
                let extracted = '';
                if (pdfParse && sf.originalname.toLowerCase().endsWith('.pdf')) {
                    try {
                        const pd = await pdfParse(fs.readFileSync(sf.path));
                        extracted = pd?.text || '';
                    } catch (_) {}
                }
                const combined = `${sf.originalname}\n${extracted}`;
                const matchInfo = ctrl.matchTextAgainstHistoriasIndex(combined, historiasIdx);
                const typInfo = ctrl.classifyHistoriaTypology(`${sf.originalname}\n${extracted.slice(0, 2500)}`, typologies);
                const uid = `FILE-${crypto.createHash('sha256').update(sf.path + Date.now()).digest('hex').slice(0, 24)}`;

                const r = await pool.query(`
                    INSERT INTO historias_correo_bandeja (
                        owner_user_id, mailbox_email, folder_name, message_uid,
                        subject, sender_email, recipient_emails, email_date,
                        radicado, nis, body_text, attachments_json,
                        detected_doc_tipo, detected_doc_numero, detected_ficha, detected_aprendiz_nombre,
                        matched_expediente_id, candidate_expedientes_json, match_confidence,
                        suggested_stage, suggested_typology_id, suggested_typology_name, pdf_mode
                    ) VALUES (
                        $1,$2,'Archivos Cargados',$3,$4,$5,'',CURRENT_TIMESTAMP,
                        $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'SOLO_ADJUNTO'
                    ) RETURNING id
                `, [
                    req.user?.id || null, mailbox_email, uid, sf.originalname, req.user?.name || mailbox_email,
                    matchInfo.radicado || null, matchInfo.nis || null, extracted.slice(0, 4000),
                    JSON.stringify([{ filename: sf.originalname, path: sf.path }]),
                    matchInfo.detected_doc_tipo, matchInfo.detected_doc_numero, matchInfo.detected_ficha, matchInfo.detected_aprendiz_nombre,
                    matchInfo.matchedExp?.id || null, JSON.stringify(matchInfo.candidates || []), matchInfo.confidence,
                    typInfo.stage, typInfo.typology_id, typInfo.typology_name
                ]);
                if (r.rows?.[0]) createdIds.push(r.rows[0].id);
            }
        }

        res.json({
            success: true,
            created_count: createdIds.length,
            message: `Se procesaron y cruzaron ${createdIds.length} elemento(s) contra las Historias Académicas.`
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] importar error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Aprobar un correo/soporte -> genera el PDF final y lo asigna a la tipología de la Historia Académica
router.post('/bandeja/:id/aprobar', requireAuth, async (req, res) => {
    try {
        const itemId = parseInt(req.params.id, 10);
        const {
            expediente_id,
            typology_name,
            pdf_mode = 'UNIFICADO',
            document_date = null
        } = req.body || {};

        const itemRes = await pool.query('SELECT * FROM historias_correo_bandeja WHERE id = $1 LIMIT 1', [itemId]);
        if (!itemRes.rows || itemRes.rows.length === 0) {
            return res.status(404).json({ error: 'Elemento no encontrado en la bandeja.' });
        }
        const item = itemRes.rows[0];
        const effExpId = Number(expediente_id || item.matched_expediente_id);
        const effTypology = String(typology_name || item.suggested_typology_name || '').trim();

        if (!effExpId) {
            return res.status(400).json({ error: 'Seleccione primero el expediente de Historia Académica del aprendiz.' });
        }
        if (!effTypology) {
            return res.status(400).json({ error: 'Seleccione la Tipología Documental TRD a asignar.' });
        }

        const saved = await ctrl.buildAndAssignHistoriaPdf({
            bandejaItem: item,
            expedienteId: effExpId,
            typologyName: effTypology,
            pdfMode: pdf_mode || item.pdf_mode || 'UNIFICADO',
            documentDate: document_date,
            userId: req.user?.id || null
        });

        await pool.query(`
            UPDATE historias_correo_bandeja
            SET matched_expediente_id = $2,
                suggested_typology_name = $3,
                pdf_mode = $4,
                verification_status = 'Verificado_Asignado',
                generated_document_id = $5,
                generated_pdf_path = $6,
                verified_by_user_id = $7,
                verified_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [itemId, effExpId, effTypology, pdf_mode, saved.document_id, saved.path, req.user?.id || null]);

        res.json({
            success: true,
            message: `PDF generado (${saved.page_count} folios) y asignado a ${saved.expediente.aprendiz_nombre} (Ficha ${saved.expediente.ficha}).`,
            ...saved
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] aprobar error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Aprobación masiva en lote de ítems ya cruzados con Historia Académica
router.post('/bandeja/aprobar-lote', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body || {};
        const cleanIds = Array.isArray(ids) ? ids.map(Number).filter(Boolean) : [];
        if (cleanIds.length === 0) {
            return res.status(400).json({ error: 'Seleccione al menos un correo con expediente identificado.' });
        }

        const itemsRes = await pool.query(
            `SELECT * FROM historias_correo_bandeja
             WHERE id = ANY($1::int[]) AND verification_status = 'Pendiente' AND matched_expediente_id IS NOT NULL`,
            [cleanIds]
        );

        let ok = 0;
        const errors = [];
        for (const item of (itemsRes.rows || [])) {
            try {
                const saved = await ctrl.buildAndAssignHistoriaPdf({
                    bandejaItem: item,
                    expedienteId: item.matched_expediente_id,
                    typologyName: item.suggested_typology_name,
                    pdfMode: item.pdf_mode || 'UNIFICADO',
                    userId: req.user?.id || null
                });
                await pool.query(`
                    UPDATE historias_correo_bandeja
                    SET verification_status = 'Verificado_Asignado',
                        generated_document_id = $2,
                        generated_pdf_path = $3,
                        verified_by_user_id = $4,
                        verified_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [item.id, saved.document_id, saved.path, req.user?.id || null]);
                ok++;
            } catch (e) {
                errors.push(`#${item.id}: ${e.message}`);
            }
        }

        res.json({
            success: true,
            approved: ok,
            errors,
            message: `Se generaron y asignaron ${ok} PDF(s) a sus respectivas Historias Académicas.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/bandeja/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(
            `UPDATE historias_correo_bandeja SET verification_status = 'Descartado' WHERE id = $1`,
            [parseInt(req.params.id, 10)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 6. CONTROL DE CONEXIÓN EN VIVO A OUTLOOK 365 WEB ─────────────────────────
router.post('/outlook/start', requireAuth, async (req, res) => {
    try {
        const {
            mailbox_email = 'leparadam@sena.edu.co',
            password = '',
            folder_name = 'Bandeja de entrada',
            search_query = '',
            max_messages = 30,
            force_restart = false
        } = req.body || {};
        const out = await ctrl.startOutlookHistoriasSync({
            mailboxEmail: mailbox_email,
            password,
            folderName: folder_name,
            searchQuery: search_query,
            maxMessages: max_messages,
            ownerUserId: req.user?.id || null,
            forceRestart: Boolean(force_restart)
        });
        res.json({ success: true, ...out });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/outlook/status', requireAuth, async (_req, res) => {
    const st = ctrl.outlookSyncState;
    res.json({
        isRunning: st.isRunning,
        status: st.status,
        mailboxEmail: st.mailboxEmail,
        folderName: st.folderName,
        mfaNumber: st.mfaNumber,
        authPrompt: st.authPrompt,
        logs: st.logs.slice(-60),
        stats: st.stats,
        lastFrame: st.lastFrame
    });
});

router.post('/outlook/interact', requireAuth, async (req, res) => {
    try {
        const { type, x, y, text, pressEnter } = req.body || {};
        const out = await ctrl.interactWithOutlookPage({ type, x, y, text, pressEnter });
        res.json({ success: true, lastFrame: out.lastFrame });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/outlook/stop', requireAuth, async (req, res) => {
    ctrl.outlookSyncState.isRunning = false;
    ctrl.outlookSyncState.status = 'idle';
    if (req.body?.close_browser && ctrl.outlookSyncState.browser) {
        const b = ctrl.outlookSyncState.browser;
        ctrl.outlookSyncState.browser = null;
        ctrl.outlookSyncState.page = null;
        Promise.race([b.close(), new Promise(r => setTimeout(r, 2000))]).catch(() => {});
    }
    res.json({ success: true });
});

// ─── 7. ASIGNACIÓN A USUARIOS DE COORDINACIONES (MENÚ + FICHAS / EXPEDIENTES) ─
router.get('/coordinaciones', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const usersRes = await pool.query(`
            SELECT u.id, u.full_name, u.document_no, u.position, u.area, u.role, u.organization_id,
                   o.subsection_code, o.subsection_name,
                   COALESCE((
                       SELECT ump.can_view FROM user_module_permissions ump
                       WHERE ump.user_id = u.id AND ump.module_id = 'historias-academicas'
                       LIMIT 1
                   ), 0)::int AS has_menu_access,
                   (SELECT COUNT(*)::int
                    FROM expediente_assignments ea
                    JOIN expedientes e ON e.id = ea.expediente_id
                    WHERE ea.user_id = u.id
                      AND (e.subserie = '68.9224.4-37' OR e.subserie LIKE '%9224.4-37%')) AS assigned_historias_count
            FROM users u
            LEFT JOIN organization_structure o ON o.id = u.organization_id
            WHERE u.is_active = 1 AND u.role != 'superadmin'
            ORDER BY
                CASE WHEN u.organization_id = 8 THEN 0 WHEN u.organization_id = 7 THEN 1 ELSE 2 END,
                u.full_name ASC
        `);

        const fichasRes = await pool.query(`
            SELECT
                COALESCE(NULLIF(TRIM((e.metadata_values::jsonb ->> 'valor4')), ''), NULLIF(TRIM((e.metadata_values::jsonb ->> 'ficha')), ''), 'SIN_FICHA') AS ficha,
                MAX(COALESCE((e.metadata_values::jsonb ->> 'valor3'), '')) AS programa,
                MAX(COALESCE((e.metadata_values::jsonb ->> 'valor1'), '')) AS nivel,
                COUNT(*)::int AS total_aprendices,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id))::int AS con_docs,
                COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = e.id))::int AS sin_docs,
                (SELECT string_agg(DISTINCT u2.full_name, ', ')
                 FROM expediente_assignments ea2
                 JOIN users u2 ON u2.id = ea2.user_id
                 WHERE ea2.expediente_id = ANY(ARRAY_AGG(e.id))) AS responsables
            FROM expedientes e
            WHERE e.subserie = '68.9224.4-37' OR e.subserie LIKE '%9224.4-37%'
            GROUP BY 1
            ORDER BY total_aprendices DESC, ficha ASC
        `);

        res.json({
            success: true,
            users: usersRes.rows || [],
            fichas: fichasRes.rows || []
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] coordinaciones error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/coordinaciones/asignar', requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            user_id,
            fichas = [],
            expediente_ids = [],
            bandeja_ids = [],
            grant_menu_access = true
        } = req.body || {};

        const targetUserId = parseInt(user_id, 10);
        if (!targetUserId) {
            return res.status(400).json({ error: 'Seleccione el usuario de Coordinación destino.' });
        }

        // 1. Habilitar acceso al menú historias-academicas + permiso TRD serie 97
        if (grant_menu_access) {
            await pool.query(`
                INSERT INTO user_module_permissions (user_id, module_id, can_view, assigned_by, updated_at)
                VALUES ($1, 'historias-academicas', 1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, module_id)
                DO UPDATE SET can_view = 1, assigned_by = EXCLUDED.assigned_by, updated_at = CURRENT_TIMESTAMP
            `, [targetUserId, req.user?.id || null]);

            const perm97 = await pool.query(
                'SELECT id FROM user_trd_permissions WHERE user_id = $1 AND series_id = 97 LIMIT 1',
                [targetUserId]
            );
            if (!perm97.rows || perm97.rows.length === 0) {
                await pool.query(
                    'INSERT INTO user_trd_permissions (user_id, series_id, subseries_id, can_view, can_upload) VALUES ($1, 97, NULL, 1, 1)',
                    [targetUserId]
                );
            }
        }

        // 2. Resolver expedientes por fichas y/o IDs directos
        let allExpIds = Array.isArray(expediente_ids) ? expediente_ids.map(Number).filter(Boolean) : [];
        if (Array.isArray(fichas) && fichas.length > 0) {
            const cleanFichas = fichas.map(f => String(f).trim()).filter(Boolean);
            const fRes = await pool.query(`
                SELECT id FROM expedientes
                WHERE (subserie = '68.9224.4-37' OR subserie LIKE '%9224.4-37%')
                  AND COALESCE(NULLIF(TRIM((metadata_values::jsonb ->> 'valor4')), ''), TRIM((metadata_values::jsonb ->> 'ficha'))) = ANY($1::text[])
            `, [cleanFichas]);
            for (const row of (fRes.rows || [])) {
                if (!allExpIds.includes(row.id)) allExpIds.push(row.id);
            }
        }

        let assignedExps = 0;
        for (const eid of allExpIds) {
            const chk = await pool.query(
                'SELECT id FROM expediente_assignments WHERE expediente_id = $1 AND user_id = $2 LIMIT 1',
                [eid, targetUserId]
            );
            if (!chk.rows || chk.rows.length === 0) {
                await pool.query(
                    `INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, estado)
                     VALUES ($1, $2, $3, 'Pendiente')`,
                    [eid, targetUserId, req.user?.id || null]
                );
                assignedExps++;
            }
        }

        let assignedEmails = 0;
        if (Array.isArray(bandeja_ids) && bandeja_ids.length > 0) {
            const cleanBIds = bandeja_ids.map(Number).filter(Boolean);
            const upd = await pool.query(
                `UPDATE historias_correo_bandeja SET assigned_user_id = $2 WHERE id = ANY($1::int[])`,
                [cleanBIds, targetUserId]
            );
            assignedEmails = upd.rowCount || 0;
        }

        res.json({
            success: true,
            assigned_expedientes: assignedExps,
            total_expedientes_selected: allExpIds.length,
            assigned_emails: assignedEmails,
            message: `Asignación completada: acceso al menú habilitado, ${allExpIds.length} Historia(s) Académica(s) vinculadas y ${assignedEmails} correo(s) asignados.`
        });
    } catch (err) {
        console.error('[HISTORIAS-ACADEMICAS] asignar error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
