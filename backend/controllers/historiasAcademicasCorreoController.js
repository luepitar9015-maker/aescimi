const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');
const mammoth = require('mammoth');
const { pool } = require('../database_pg');

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (_) {}

const STORAGE_ROOT = (() => {
    if (process.platform === 'linux' && fs.existsSync('/mnt/almacen')) {
        return '/mnt/almacen';
    }
    const local = path.join(__dirname, '..', 'uploads', 'almacen_local');
    try { fs.mkdirSync(local, { recursive: true }); } catch (_) {}
    return local;
})();

const INBOX_STORAGE_DIR = path.join(STORAGE_ROOT, 'historias_correo_inbox');
try { fs.mkdirSync(INBOX_STORAGE_DIR, { recursive: true }); } catch (_) {}

function resolveOutlookProfileDir(mailboxEmail = 'leparadam@sena.edu.co') {
    const cleanEmail = String(mailboxEmail || 'leparadam@sena.edu.co').trim().toLowerCase();
    // Reutilizar el perfil persistente oficial ya autenticado de leparadam@sena.edu.co
    if (!cleanEmail || cleanEmail === 'leparadam@sena.edu.co') {
        const sharedDir = path.join(__dirname, '..', 'uploads', 'outlook_profile_leparadam');
        try { fs.mkdirSync(sharedDir, { recursive: true }); } catch (_) {}
        return { dir: sharedDir, isSharedLeparadam: true, slug: 'outlook_profile_leparadam' };
    }
    const slug = `outlook_profile_${cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 40)}`;
    if (process.platform === 'linux' && fs.existsSync('/mnt/almacen')) {
        const d = path.join('/mnt/almacen/.puppeteer_tmp', slug);
        try { fs.mkdirSync(d, { recursive: true }); return { dir: d, isSharedLeparadam: false, slug }; } catch (_) {}
    }
    const d = path.join(__dirname, '..', 'uploads', slug);
    try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
    return { dir: d, isSharedLeparadam: false, slug };
}

const withTimeout = (promise, ms, fallbackVal = null) =>
    Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(fallbackVal), ms))
    ]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const normStr = (s) =>
    String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

// ─── REGLAS DE CLASIFICACIÓN HACIA LAS 36 TIPOLOGÍAS OFICIALES DE 68.9224.4-37 ─
const TYPOLOGY_RULES = [
    // 1. Ingreso
    { match: /SIMAT|ARTICULACION CON LA MEDIA|MATRICULA ESTUDIANTIL/i, stage: '1. Ingreso', name: 'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA Y MEDIA- SIMAT, ARTICULACION CON LA MEDIA' },
    { match: /ACTA DE COMPROMISO|COMPROMISO DEL APRENDIZ/i, stage: '1. Ingreso', name: 'ACTA DE COMPROMISO DEL APRENDIZ' },
    { match: /AUTORIZACION.*MENOR|TRATAMIENTO DE DATOS.*MENOR/i, stage: '1. Ingreso', name: 'AUTORIZACION DE DATOS DE MENOR DE EDAD' },
    { match: /PADRE.*TUTOR|ACUDIENTE|IDENTIFICACION DEL PADRE/i, stage: '1. Ingreso', name: 'DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE' },
    { match: /CONVALIDACION/i, stage: '1. Ingreso', name: 'DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS' },
    { match: /\bEPS\b|AFILIACION.*SALUD|ADRES|FOSYGA/i, stage: '1. Ingreso', name: 'CERTIFICADO DE AFILIACION EPS' },
    { match: /SABER\s*11|\bICFES\b(?!.*TYT)/i, stage: '1. Ingreso', name: 'RESULTADO PRUEBA ICFES, SABER 11' },
    { match: /ASISTENCIA.*MATRICULA|FORMALIZAR MATRICULA/i, stage: '1. Ingreso', name: 'REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA' },
    { match: /DIPLOMA.*BACHILLER|ACTA DE GRADO.*BACHILLER|CERTIFICADO.*MATRICULA/i, stage: '1. Ingreso', name: 'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA SALVO REGULACION ESPECIAL' },
    { match: /CAMBIO.*DOCUMENTO DE IDENTIDAD|ACTUALIZACION.*TI A CC/i, stage: '3. Certificación', name: 'DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO' },
    { match: /CEDULA DE CIUDADANIA|TARJETA DE IDENTIDAD|DOCUMENTO DE IDENTIDAD VIGENTE|\bPPT\b.*IDENTIDAD/i, stage: '1. Ingreso', name: 'DOCUMENTO DE IDENTIDAD VIGENTE' },

    // 2. Ejecución
    { match: /PENSION DE SOBREVIVIENTES/i, stage: '2. Ejecución', name: 'CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES' },
    { match: /CITACION.*COMITE|LLAMADO DE ATENCION|PRESUNTA DESERCION/i, stage: '2. Ejecución', name: 'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO' },
    { match: /ACTA.*COMITE.*SEGUIMIENTO|ACTA.*EVALUACION Y SEGUIMIENTO/i, stage: '2. Ejecución', name: 'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA LECTIVA Y/O PRODUCTIVA' },
    { match: /ACTO ADMINISTRATIVO.*RECURSO.*REPOSICION|RESUELVE RECURSO DE REPOSICION/i, stage: '2. Ejecución', name: 'ACTO ADMINISTRATIVO RECURSO REPOSICION' },
    { match: /RECURSO DE REPOSICION/i, stage: '2. Ejecución', name: 'SOLICITUD DE RECURSO DE REPOSICION' },
    { match: /RESOLUCION.*DESERCION|CANCELACION.*MATRICULA|PLAN DE MEJORAMIENTO|RESOLUCION.*SANCIONATORIA|RESOLUCION.*REINGRESO/i, stage: '2. Ejecución', name: 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PLAN DE MEJORAMIENTO ACADEMICO O DISCIPLINARIO' },
    { match: /RESPUESTA.*SOLICITUD DE NOVEDAD|APROBACION.*APLAZAMIENTO|APROBACION.*RETIRO VOLUNTARIO|APROBACION.*TRASLADO/i, stage: '2. Ejecución', name: 'RESPUESTA A SOLICITUD DE NOVEDAD' },
    { match: /SOLICITUD.*NOVEDAD|RETIRO VOLUNTARIO|SOLICITUD.*APLAZAMIENTO|SOLICITUD.*TRASLADO|SOLICITUD.*REINGRESO|CONDICIONAMIENTO/i, stage: '2. Ejecución', name: 'SOLICITUD DE NOVEDADES REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO, TRASLADO Y CONDICIONAMIENTO' },
    { match: /PRESENTACION.*ETAPA PRACTICA|CARTA DE PRESENTACION/i, stage: '2. Ejecución', name: 'COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA' },
    { match: /CIERRE.*ETAPA LECTIVA/i, stage: '2. Ejecución', name: 'ACTA DE CIERRE ETAPA LECTIVA' },
    { match: /CAMBIO.*ETAPA PRODUCTIVA|CAMBIO DE ALTERNATIVA/i, stage: '2. Ejecución', name: 'SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA' },
    { match: /SELECCION.*ETAPA PRODUCTIVA|ALTERNATIVA.*ETAPA PRODUCTIVA/i, stage: '2. Ejecución', name: 'COMUNICACION SELECCION DE ETAPA PRODUCTIVA' },
    { match: /\bARL\b|RIESGOS LABORALES/i, stage: '2. Ejecución', name: 'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES - ARL' },
    { match: /BITACORA.*ETAPA PRODUCTIVA|\bBITACORA\b.*\d+|GFPI-F-147/i, stage: '2. Ejecución', name: 'BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA' },
    { match: /PLANEACION.*SEGUIMIENTO.*EVALUACION.*ETAPA PRODUCTIVA|GFPI-F-023/i, stage: '2. Ejecución', name: 'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTIVA' },
    { match: /CERTIFICADO.*EMPRESA.*ETAPA PRODUCTIVA|PAZ Y SALVO EMPRESA|CERTIFICACION.*TERMINACION.*ETAPA PRODUCTIVA/i, stage: '2. Ejecución', name: 'CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA' },
    { match: /BIENESTAR.*PREVENCION.*DESERCION|RUTA DE ATENCION.*BIENESTAR/i, stage: '2. Ejecución', name: 'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENCION DE LA DESERCION' },
    { match: /QUEJA|RECLAMACION.*FORMACION/i, stage: '2. Ejecución', name: 'QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION' },

    // 3. Certificación
    { match: /PAZ Y SALVO ACADEMICO|PAZ Y SALVO.*CERTIFICACION/i, stage: '3. Certificación', name: 'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION DE INSTITUCION EDUCATIVA' },
    { match: /\bAPE\b|AGENCIA PUBLICA DE EMPLEO/i, stage: '3. Certificación', name: 'CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE' },
    { match: /SABER\s*TYT|\bTYT\b/i, stage: '3. Certificación', name: 'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DEL NIVEL TECNOLOGICO' },
    { match: /BUENA CONDUCTA/i, stage: '3. Certificación', name: 'CONSTANCIA DE BUENA CONDUCTA' },
    { match: /APOSTILLA/i, stage: '3. Certificación', name: 'CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR' },
    { match: /MODIFICACION DE DOCUMENTOS ACADEMICOS/i, stage: '3. Certificación', name: 'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO SOPORTE' },
    { match: /DUPLICADOS.*2000/i, stage: '3. Certificación', name: 'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS ANOS ANTERIORES AL ANO 2000' }
];

let schemaPromise = null;
function ensureHistoriasCorreoSchema() {
    if (schemaPromise) return schemaPromise;
    schemaPromise = (async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS historias_correo_bandeja (
                    id SERIAL PRIMARY KEY,
                    owner_user_id INTEGER,
                    assigned_user_id INTEGER,
                    mailbox_email TEXT,
                    folder_name TEXT DEFAULT 'Bandeja de entrada',
                    message_uid TEXT UNIQUE,
                    subject TEXT,
                    sender_email TEXT,
                    recipient_emails TEXT,
                    email_date TIMESTAMPTZ,
                    radicado TEXT,
                    nis TEXT,
                    body_text TEXT,
                    body_html TEXT,
                    attachments_json JSONB DEFAULT '[]'::jsonb,
                    detected_doc_tipo TEXT,
                    detected_doc_numero TEXT,
                    detected_ficha TEXT,
                    detected_aprendiz_nombre TEXT,
                    matched_expediente_id INTEGER,
                    candidate_expedientes_json JSONB DEFAULT '[]'::jsonb,
                    match_confidence TEXT DEFAULT 'SIN_COINCIDENCIA',
                    suggested_stage TEXT,
                    suggested_typology_id INTEGER,
                    suggested_typology_name TEXT,
                    pdf_mode TEXT DEFAULT 'UNIFICADO',
                    verification_status TEXT DEFAULT 'Pendiente',
                    generated_document_id INTEGER,
                    generated_pdf_path TEXT,
                    verified_by_user_id INTEGER,
                    verified_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_hist_correo_status ON historias_correo_bandeja (verification_status)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_hist_correo_assigned ON historias_correo_bandeja (assigned_user_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_hist_correo_exp ON historias_correo_bandeja (matched_expediente_id)');
            console.log('[HISTORIAS-CORREO] Schema verified.');
        } catch (err) {
            console.error('[HISTORIAS-CORREO] Schema error:', err.message);
        }
    })();
    return schemaPromise;
}

ensureHistoriasCorreoSchema();

// ─── CARGA DE CATÁLOGO DE 36 TIPOLOGÍAS E ÍNDICE DE EXPEDIENTES 68.9224.4-37 ──
async function getOfficial37Typologies() {
    const res = await pool.query(`
        SELECT id, typology_name, onbase_name, COALESCE(stage, '2. Ejecución') AS stage
        FROM trd_typologies
        WHERE series_id = 97
        ORDER BY id ASC
    `);
    return res.rows || [];
}

function classifyHistoriaTypology(textSample, typologiesList = []) {
    const cleanSample = normStr(textSample);
    for (const rule of TYPOLOGY_RULES) {
        if (rule.match.test(cleanSample)) {
            const found = typologiesList.find(t => normStr(t.typology_name) === normStr(rule.name))
                || typologiesList.find(t => normStr(t.typology_name).includes(normStr(rule.name).slice(0, 32)));
            return {
                stage: found?.stage || rule.stage,
                typology_id: found?.id || null,
                typology_name: found?.typology_name || rule.name
            };
        }
    }
    const fallback = typologiesList.find(t => normStr(t.typology_name).includes('SOLICITUD DE NOVEDADES'))
        || typologiesList[0]
        || { id: null, typology_name: 'SOLICITUD DE NOVEDADES REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO, TRASLADO Y CONDICIONAMIENTO', stage: '2. Ejecución' };
    return {
        stage: fallback.stage || '2. Ejecución',
        typology_id: fallback.id || null,
        typology_name: fallback.typology_name
    };
}

function parseExp37Meta(r) {
    let m = {};
    if (r.metadata_values) {
        try {
            m = typeof r.metadata_values === 'string' ? JSON.parse(r.metadata_values) : r.metadata_values;
            if (typeof m === 'string') m = JSON.parse(m);
        } catch (_) { m = {}; }
    }
    const ficha = String(m.ficha || m.valor4 || m['Valor 4'] || '').trim();
    const candidates = [
        String(m.numero_documento || '').trim(),
        String(m.documento || '').trim(),
        String(m.valor6 || '').trim(),
        String(m.valor7 || '').trim(),
        String(m.valor5 || '').trim(),
        String(r.title || '').trim()
    ];
    let docNum = '';
    let docTipo = 'CC';
    for (const c of candidates) {
        const m1 = c.toUpperCase().match(/^(CC|TI|CE|PPT|PEP|RC|PA)?\s*[-:]?\s*(\d{5,15})$/);
        if (m1) {
            if (m1[1]) docTipo = m1[1];
            docNum = m1[2];
            break;
        }
        const m2 = c.toUpperCase().match(/\b(CC|TI|CE|PPT|PEP)\s*[-:.]?\s*(\d{5,15})\b/);
        if (m2 && !docNum) {
            docTipo = m2[1];
            docNum = m2[2];
        }
    }
    if (!docNum) {
        for (const c of candidates) {
            const m3 = c.match(/\b(\d{6,15})\b/);
            if (m3) { docNum = m3[1]; break; }
        }
    }
    const v5Upper = String(m.valor5 || '').trim().toUpperCase();
    if (/^(CC|TI|CE|PPT|PEP|RC|PA)$/.test(v5Upper)) {
        docTipo = v5Upper;
    }

    let aprendizNombre = '';
    const v6 = String(m.valor6 || '').trim();
    const v7 = String(m.valor7 || '').trim();
    if (v7 && !/^\d+$/.test(v7)) aprendizNombre = v7;
    else if (v6 && !/^\d+$/.test(v6)) aprendizNombre = v6;
    else if (r.title) aprendizNombre = String(r.title).replace(/^(CC|TI|CE|PPT|PEP)?\s*\d+\s*[-:]?\s*/i, '').trim();

    return {
        id: r.id,
        expediente_code: String(r.expediente_code || '').trim(),
        subserie: r.subserie || '68.9224.4-37',
        title: r.title || '',
        ficha,
        doc_tipo: docTipo,
        doc_numero: docNum,
        aprendiz_nombre: aprendizNombre,
        nivel: String(m.valor1 || '').trim(),
        modalidad: String(m.valor2 || '').trim(),
        programa: String(m.valor3 || '').trim(),
        docs_count: Number(r.docs_count || 0)
    };
}

async function loadHistoriasIndex() {
    const res = await pool.query(`
        SELECT e.id, e.expediente_code, e.subserie, e.title, e.metadata_values,
               (SELECT COUNT(*)::int FROM documents d WHERE d.expediente_id = e.id) AS docs_count
        FROM expedientes e
        WHERE e.subserie = '68.9224.4-37' OR e.subserie LIKE '%9224.4-37%'
    `);
    const byFichaDoc = new Map();
    const byDoc = new Map();
    const all = [];

    for (const r of (res.rows || [])) {
        const parsed = parseExp37Meta(r);
        all.push(parsed);
        if (parsed.ficha && parsed.doc_numero) {
            byFichaDoc.set(`${parsed.ficha}_${parsed.doc_numero}`, parsed);
        }
        if (parsed.doc_numero) {
            if (!byDoc.has(parsed.doc_numero)) byDoc.set(parsed.doc_numero, []);
            byDoc.get(parsed.doc_numero).push(parsed);
        }
    }
    return { all, byFichaDoc, byDoc };
}

/**
 * Cruza un texto de correo + adjuntos contra todos los expedientes 68.9224.4-37 registrados
 */
function matchTextAgainstHistoriasIndex(combinedText, index) {
    const raw = String(combinedText || '');
    const norm = normStr(raw);

    // 1. Buscar fichas candidatas (7 dígitos que existan en nuestras historias o precedidas por FICHA)
    const fichaExplicit = [];
    const fichaRx = /FICHA\s*(?:NO\.?|N[°º]?|#|:)?\s*(\d{6,8})\b/gi;
    let fm;
    while ((fm = fichaRx.exec(norm)) !== null) {
        if (!fichaExplicit.includes(fm[1])) fichaExplicit.push(fm[1]);
    }
    const all7Digits = Array.from(new Set((raw.match(/\b\d{7}\b/g) || [])));

    // 2. Buscar números de documento que existan en index.byDoc
    const numberTokens = Array.from(new Set((raw.replace(/\./g, '').match(/\b\d{6,12}\b/g) || [])));
    const matchedDocs = numberTokens.filter(tok => index.byDoc.has(tok));

    let matchedExp = null;
    let candidates = [];
    let confidence = 'SIN_COINCIDENCIA';

    if (matchedDocs.length > 0) {
        const docNum = matchedDocs[0];
        const docExps = index.byDoc.get(docNum) || [];
        candidates = docExps;

        if (docExps.length === 1) {
            matchedExp = docExps[0];
            confidence = (fichaExplicit.includes(matchedExp.ficha) || all7Digits.includes(matchedExp.ficha))
                ? 'EXACTO_FICHA_DOC'
                : 'DOC_UNICO';
        } else if (docExps.length > 1) {
            const byExplicitFicha = docExps.find(e => fichaExplicit.includes(e.ficha) || all7Digits.includes(e.ficha));
            if (byExplicitFicha) {
                matchedExp = byExplicitFicha;
                confidence = 'EXACTO_FICHA_DOC';
            } else {
                // Priorizar el que tenga documentos o apertura más reciente
                matchedExp = [...docExps].sort((a, b) => b.id - a.id)[0];
                confidence = 'MULTI_FICHA';
            }
        }
    } else {
        // 3. Fallback por nombre completo del aprendiz (>= 3 palabras o >= 14 caracteres)
        const fichaScope = fichaExplicit.length > 0
            ? index.all.filter(e => fichaExplicit.includes(e.ficha))
            : (all7Digits.length > 0 ? index.all.filter(e => all7Digits.includes(e.ficha)) : index.all);

        for (const e of fichaScope) {
            const nName = normStr(e.aprendiz_nombre);
            if (nName.length >= 12 && nName.split(' ').length >= 2 && norm.includes(nName)) {
                matchedExp = e;
                candidates = [e];
                confidence = fichaExplicit.includes(e.ficha) ? 'POR_NOMBRE_Y_FICHA' : 'POR_NOMBRE';
                break;
            }
        }
    }

    // Extraer Radicado / NIS si viene en el correo
    const radMatch = raw.match(/\b(\d{2}-\d-\d{4}-\d{4,8}|7-?202\d-?\d{5,9})\b/);
    const nisMatch = raw.match(/\b(202\d-\d{2}-\d{5,9})\b/);

    return {
        matchedExp,
        candidates,
        confidence,
        detected_ficha: matchedExp?.ficha || fichaExplicit[0] || '',
        detected_doc_tipo: matchedExp?.doc_tipo || 'CC',
        detected_doc_numero: matchedExp?.doc_numero || '',
        detected_aprendiz_nombre: matchedExp?.aprendiz_nombre || '',
        radicado: radMatch ? radMatch[1] : '',
        nis: nisMatch ? nisMatch[1] : ''
    };
}

// ─── ESTADO DEL ROBOT DE SINCRONIZACIÓN OUTLOOK 365 WEB ───────────────────────
const outlookSyncState = {
    isRunning: false,
    status: 'idle', // 'idle' | 'running' | 'waiting_auth' | 'completed' | 'error'
    mailboxEmail: 'leparadam@sena.edu.co',
    folderName: 'Bandeja de entrada',
    mfaNumber: null,
    authPrompt: null,
    logs: [],
    lastFrame: null,
    currentUrl: '',
    browser: null,
    page: null,
    activeProfileSlug: null,
    frameTimer: null,
    _capturing: false,
    _triedAutoPass: false,
    _clickedAuthPushCount: 0,
    _troubleReloadCount: 0,
    _lastMfaLogged: null,
    stats: { scanned: 0, savedToInbox: 0, matched: 0, duplicates: 0 }
};

function addOutlookLog(msg) {
    const ts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' });
    const line = `[${ts}] ${msg}`;
    outlookSyncState.logs.push(line);
    if (outlookSyncState.logs.length > 300) outlookSyncState.logs.shift();
}

async function flushMicrosoftLoginAnimations(page) {
    if (!page || page.isClosed()) return;
    try {
        await withTimeout(page.evaluate(() => {
            const lb = document.querySelector('#lightbox');
            const pv = document.querySelector('.pagination-view');
            if (window.ko && lb) {
                try {
                    const ctx = window.ko.contextFor(lb);
                    if (ctx?.$page?.paginationControlHelper?.animationEnd) {
                        ctx.$page.paginationControlHelper.animationEnd();
                    }
                } catch (_) {}
            }
            [lb, pv, ...(document.querySelectorAll('.animate, .slide-in-next, .slide-in-back, .pagination-view > div'))]
                .filter(Boolean)
                .forEach(el => {
                    try {
                        el.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
                        el.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }));
                    } catch (_) {}
                });
        }), 1200);
    } catch (_) {}
}

async function captureOutlookFrame() {
    if (!outlookSyncState.page || outlookSyncState._capturing) return;
    outlookSyncState._capturing = true;
    try {
        if (outlookSyncState.page.isClosed()) return;
        if (outlookSyncState.browser) {
            try {
                const pages = await withTimeout(outlookSyncState.browser.pages(), 1200, []);
                if (Array.isArray(pages) && pages.length > 1) {
                    for (const p of pages) {
                        if (p !== outlookSyncState.page && /support\.microsoft\.com|aka\.ms/i.test(p.url() || '')) {
                            await p.close().catch(() => {});
                        }
                    }
                    await outlookSyncState.page.bringToFront().catch(() => {});
                }
            } catch (_) {}
        }
        outlookSyncState.currentUrl = outlookSyncState.page.url() || '';
        if (/login\.microsoftonline\.com|login\.live\.com/i.test(outlookSyncState.currentUrl)) {
            await flushMicrosoftLoginAnimations(outlookSyncState.page);
        }
        const b64 = await withTimeout(
            outlookSyncState.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 65 }),
            2500,
            null
        );
        if (b64) outlookSyncState.lastFrame = `data:image/jpeg;base64,${b64}`;
    } catch (_) {
    } finally {
        outlookSyncState._capturing = false;
    }
}

function ensureContinuousOutlookFrameCapture() {
    if (outlookSyncState.frameTimer) clearInterval(outlookSyncState.frameTimer);
    outlookSyncState.frameTimer = setInterval(async () => {
        if (!outlookSyncState.isRunning && outlookSyncState.page && !outlookSyncState.page.isClosed()) {
            try {
                await captureOutlookFrame();
                const liveInfo = await withTimeout(outlookSyncState.page.evaluate(() => {
                    const mfaEl = document.querySelector('#idRichContext_DisplaySign, #displaySign, .displaySign, [data-bind*="displaySign"]');
                    const mfaNum = (mfaEl && mfaEl.offsetParent !== null) ? mfaEl.innerText.trim() : null;
                    const hasMail = Boolean(
                        document.querySelector('[role="tree"]') ||
                        document.querySelector('#MainModule') ||
                        document.querySelector('#topSearchInput') ||
                        document.querySelector('[data-app-section="NavigationPane"]') ||
                        document.querySelector('[data-app-section="MessageList"]')
                    );
                    return { mfaNum, hasMail };
                }), 1500, null);
                if (liveInfo) {
                    if (liveInfo.mfaNum) {
                        outlookSyncState.mfaNumber = liveInfo.mfaNum;
                        outlookSyncState.status = 'waiting_auth';
                        outlookSyncState.authPrompt = `Apruebe en Microsoft Authenticator el número: ${liveInfo.mfaNum}`;
                    } else if (liveInfo.hasMail && outlookSyncState.status === 'waiting_auth') {
                        outlookSyncState.mfaNumber = null;
                        outlookSyncState.authPrompt = null;
                        outlookSyncState.status = 'completed';
                    }
                }
            } catch (_) {}
        }
    }, 1800);
}

async function ensureOutlookBrowserOpen(mailboxEmail = 'leparadam@sena.edu.co') {
    const profileInfo = resolveOutlookProfileDir(mailboxEmail);

    if (
        outlookSyncState.browser &&
        outlookSyncState.page &&
        outlookSyncState.activeProfileSlug === profileInfo.slug
    ) {
        try {
            if (outlookSyncState.browser.isConnected() && !outlookSyncState.page.isClosed()) {
                const ok = await withTimeout(outlookSyncState.page.title(), 2000, null);
                if (ok !== null) {
                    ensureContinuousOutlookFrameCapture();
                    return { browser: outlookSyncState.browser, page: outlookSyncState.page, reused: true };
                }
            }
        } catch (_) {}
        try { await withTimeout(outlookSyncState.browser.close(), 1500); } catch (_) {}
        outlookSyncState.browser = null;
        outlookSyncState.page = null;
    } else if (outlookSyncState.browser && outlookSyncState.activeProfileSlug !== profileInfo.slug) {
        try { await withTimeout(outlookSyncState.browser.close(), 1500); } catch (_) {}
        outlookSyncState.browser = null;
        outlookSyncState.page = null;
    }

    // 1. Intentar reconectar si el navegador persistente ya está vivo en el servidor (ej. perfil compartido leparadam)
    const activePortFile = path.join(profileInfo.dir, 'DevToolsActivePort');
    if (fs.existsSync(activePortFile)) {
        try {
            const lines = fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
            if (lines.length >= 2 && lines[0] && lines[1]) {
                const wsEndpoint = `ws://127.0.0.1:${lines[0].trim()}${lines[1].trim()}`;
                const existingBrowser = await withTimeout(
                    puppeteer.connect({
                        browserWSEndpoint: wsEndpoint,
                        protocolTimeout: 20000,
                        defaultViewport: { width: 1366, height: 860 }
                    }),
                    3500,
                    null
                );
                if (existingBrowser) {
                    const existingPages = await withTimeout(existingBrowser.pages(), 2000, []);
                    const existingPage = existingPages.find(p => /outlook|microsoft/i.test(p.url() || '')) || existingPages[existingPages.length - 1];
                    if (existingPage && !existingPage.isClosed()) {
                        const titleOk = await withTimeout(existingPage.title(), 2000, null);
                        if (titleOk !== null) {
                            outlookSyncState.browser = existingBrowser;
                            outlookSyncState.page = existingPage;
                            outlookSyncState.activeProfileSlug = profileInfo.slug;
                            ensureContinuousOutlookFrameCapture();
                            return { browser: existingBrowser, page: existingPage, reused: true };
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // 2. Limpiar procesos huérfanos / bloqueos de ese perfil antes de lanzar nuevo Chromium
    if (process.platform === 'linux') {
        try {
            require('child_process').execSync(`pkill -9 -f ${profileInfo.slug} || true`);
        } catch (_) {}
    }
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(lockFile => {
        const p = path.join(profileInfo.dir, lockFile);
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    });

    const execPath = (() => {
        if (process.platform === 'linux') {
            for (const c of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) {
                if (fs.existsSync(c)) return c;
            }
        }
        return undefined;
    })();

    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: execPath,
        userDataDir: profileInfo.dir,
        protocolTimeout: 20000,
        defaultViewport: { width: 1366, height: 860 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1366,860'
        ]
    });

    const oldPages = await browser.pages();
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 860 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // CRÍTICO: Evitar bloqueo por Windows Hello / Passkey (FIDO2) y desbloquear animaciones KnockoutJS en login.microsoftonline.com
    const injectWebAuthnAndAnimationBypass = () => {
        if (navigator.credentials && navigator.credentials.get) {
            navigator.credentials.get = function () {
                return new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'));
                    }, 250);
                });
            };
        }
        setInterval(() => {
            try {
                if (!/login\.microsoftonline\.com|login\.live\.com/i.test(window.location.href)) return;
                const animating = document.querySelector('.pagination-view.animate, .slide-in-next, .slide-in-prev, .slide-out-next, .slide-out-prev');
                if (!animating) return;
                if (window.ko && typeof window.ko.contextFor === 'function') {
                    const lb = document.querySelector('#lightbox') || animating;
                    const ctx = window.ko.contextFor(lb);
                    if (ctx && ctx.$page && ctx.$page.paginationControlHelper && typeof ctx.$page.paginationControlHelper.animationEnd === 'function') {
                        ctx.$page.paginationControlHelper.animationEnd();
                    }
                }
                document.querySelectorAll('.pagination-view, .animate, .slide-in-next, .slide-in-prev, #lightbox').forEach(el => {
                    try {
                        el.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
                        el.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true }));
                    } catch (_) {}
                });
            } catch (_) {}
        }, 450);
    };
    await page.evaluateOnNewDocument(injectWebAuthnAndAnimationBypass);
    for (const op of oldPages) {
        try { await op.close(); } catch (_) {}
    }

    browser.on('targetcreated', async (target) => {
        try {
            if (target.type() === 'page') {
                const newP = await target.page();
                if (newP && newP !== outlookSyncState.page) {
                    await sleep(500);
                    const u = newP.url() || '';
                    if (!/outlook\.(office|office365)\.com|outlook\.cloud\.microsoft|login\.microsoftonline\.com/i.test(u)) {
                        await newP.close().catch(() => {});
                    }
                }
            }
        } catch (_) {}
    });

    outlookSyncState.browser = browser;
    outlookSyncState.page = page;
    outlookSyncState.activeProfileSlug = profileInfo.slug;
    ensureContinuousOutlookFrameCapture();
    return { browser, page, reused: false };
}

/**
 * Envía un correo desde la sesión autenticada de Outlook 365 Web (si está activa en el servidor)
 */
async function sendEmailViaOutlookWeb({ to, subject, htmlBody, attachmentPath }) {
    try {
        if (!outlookSyncState.page || outlookSyncState.page.isClosed()) {
            return { sent: false, reason: 'Sesión Outlook 365 Web no abierta aún en el servidor.' };
        }
        const page = outlookSyncState.page;
        const url = page.url() || '';
        if (!url.includes('outlook.office') && !url.includes('outlook.cloud.microsoft')) {
            return { sent: false, reason: 'El navegador Outlook no se encuentra autenticado en el buzón.' };
        }

        // Click "Correo nuevo" / "New mail"
        const clickedNew = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
            const nb = btns.find(b => /correo nuevo|nuevo correo|new mail|new message/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
            if (nb) { nb.click(); return true; }
            return false;
        });
        if (!clickedNew) return { sent: false, reason: 'No se encontró botón Correo nuevo en Outlook Web.' };
        await sleep(2200);

        // Fill "Para" / "To"
        const toInput = await page.$('div[aria-label*="Para" i][contenteditable="true"], div[aria-label*="To" i][contenteditable="true"], input[aria-label*="Para" i], input[aria-label*="To" i]');
        if (toInput) {
            await toInput.click();
            await page.keyboard.type(to, { delay: 18 });
            await page.keyboard.press('Enter');
            await sleep(700);
        }

        // Fill Subject
        const subjInput = await page.$('input[placeholder*="asunto" i], input[placeholder*="subject" i], input[aria-label*="asunto" i], input[aria-label*="subject" i]');
        if (subjInput) {
            await subjInput.click({ clickCount: 3 });
            await page.keyboard.type(subject, { delay: 10 });
            await sleep(400);
        }

        // Fill Body HTML
        await page.evaluate((html) => {
            const editor = document.querySelector('div[aria-label*="Cuerpo del mensaje" i][contenteditable="true"], div[aria-label*="Message body" i][contenteditable="true"]');
            if (editor) {
                editor.focus();
                editor.innerHTML = html;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, htmlBody);
        await sleep(600);

        // Attach file if present
        if (attachmentPath && fs.existsSync(attachmentPath)) {
            const fileInputs = await page.$$('input[type="file"]');
            if (fileInputs.length > 0) {
                await fileInputs[0].uploadFile(attachmentPath);
                await sleep(2800);
            }
        }

        // Click Enviar / Send
        const sentClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
            const sb = btns.find(b => /^(enviar|send)$/i.test((b.innerText || '').trim()) || /^(enviar|send)\b/i.test((b.getAttribute('aria-label') || '').trim()));
            if (sb) { sb.click(); return true; }
            return false;
        });
        await sleep(2000);
        return { sent: Boolean(sentClicked), reason: sentClicked ? null : 'No se pudo pulsar Enviar.' };
    } catch (err) {
        return { sent: false, reason: err.message };
    }
}

// ─── GENERADOR PDF UNIFICADO (CORREO + ADJUNTOS) ─────────────────────────────
function wrapLines(text, maxChars = 92) {
    const out = [];
    for (const rawLine of String(text || '').split(/\r?\n/)) {
        const line = rawLine.replace(/\t/g, '    ').trimEnd();
        if (line.length <= maxChars) {
            out.push(line);
        } else {
            let cur = line;
            while (cur.length > maxChars) {
                let cut = cur.lastIndexOf(' ', maxChars);
                if (cut < 30) cut = maxChars;
                out.push(cur.slice(0, cut));
                cur = cur.slice(cut).trimStart();
            }
            if (cur) out.push(cur);
        }
    }
    return out;
}

async function renderEmailCoverAndBodyPdf(item, expInfo, typologyName) {
    const safeHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 28px 34px; font-size: 12px; line-height: 1.5; }
  .banner { border-bottom: 3px solid #39A900; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .banner h1 { font-size: 15px; color: #00324d; margin: 0; }
  .banner span { font-size: 10px; color: #475569; font-weight: bold; }
  .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; }
  .meta-row { margin: 3px 0; }
  .meta-label { font-weight: bold; color: #00324d; display: inline-block; width: 135px; }
  .body-box { border-top: 1px solid #e2e8f0; padding-top: 12px; word-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11px; }
</style>
</head>
<body>
  <div class="banner">
    <div>
      <h1>SENA · CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL (CIMI)</h1>
      <div style="font-size:11px;color:#334155;">Soporte Documental Sincronizado desde Correo Institucional · Serie 68.9224.4-37 Historias Académicas</div>
    </div>
    <span>${expInfo.expediente_code || `Ficha ${expInfo.ficha}`}</span>
  </div>
  <div class="meta-box">
    <div class="meta-row"><span class="meta-label">Asunto:</span> ${String(item.subject || '(Sin asunto)').replace(/</g, '&lt;')}</div>
    <div class="meta-row"><span class="meta-label">De:</span> ${String(item.sender_email || '').replace(/</g, '&lt;')}</div>
    <div class="meta-row"><span class="meta-label">Para:</span> ${String(item.recipient_emails || '').replace(/</g, '&lt;')}</div>
    <div class="meta-row"><span class="meta-label">Fecha del Correo:</span> ${item.email_date ? new Date(item.email_date).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : ''}</div>
    ${item.radicado ? `<div class="meta-row"><span class="meta-label">Radicado / NIS:</span> ${item.radicado} ${item.nis ? `| NIS: ${item.nis}` : ''}</div>` : ''}
    <div class="meta-row"><span class="meta-label">Aprendiz / Ficha:</span> ${expInfo.doc_tipo} ${expInfo.doc_numero} - ${expInfo.aprendiz_nombre} (Ficha ${expInfo.ficha})</div>
    <div class="meta-row"><span class="meta-label">Tipología TRD:</span> ${typologyName}</div>
  </div>
  <div class="body-box">
    ${item.body_html && item.body_html.trim().length > 20
        ? item.body_html
        : `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:11.5px;">${String(item.body_text || '').replace(/</g, '&lt;')}</pre>`}
  </div>
</body>
</html>`;

    // Try high-fidelity HTML->PDF via temporary headless page, with pure pdf-lib fallback
    let tempBrowser = null;
    try {
        const execPath = (() => {
            if (process.platform === 'linux') {
                for (const c of ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']) {
                    if (fs.existsSync(c)) return c;
                }
            }
            return undefined;
        })();
        tempBrowser = await puppeteer.launch({
            headless: 'new',
            executablePath: execPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const p = await tempBrowser.newPage();
        await p.setContent(safeHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const pdfUint8 = await p.pdf({
            format: 'Letter',
            printBackground: true,
            margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' }
        });
        await tempBrowser.close();
        return Buffer.from(pdfUint8);
    } catch (_) {
        if (tempBrowser) { try { await tempBrowser.close(); } catch (_) {} }
        // Pure pdf-lib fallback
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const headerLines = [
            'SENA - CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL (CIMI)',
            'SOPORTE DE CORREO ELECTRONICO - HISTORIAS ACADEMICAS (68.9224.4-37)',
            '----------------------------------------------------------------------------------------',
            `Asunto: ${item.subject || ''}`,
            `De: ${item.sender_email || ''}   |   Para: ${item.recipient_emails || ''}`,
            `Fecha Correo: ${item.email_date ? new Date(item.email_date).toISOString().slice(0, 19).replace('T', ' ') : ''}`,
            `Aprendiz: ${expInfo.doc_tipo} ${expInfo.doc_numero} - ${expInfo.aprendiz_nombre} | Ficha: ${expInfo.ficha}`,
            `Tipologia TRD: ${typologyName}`,
            '----------------------------------------------------------------------------------------',
            ''
        ];
        const allLines = [
            ...headerLines,
            ...wrapLines(String(item.body_text || '').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ' '), 90)
        ];
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        for (let i = 0; i < allLines.length; i++) {
            if (y < 45) {
                page = pdfDoc.addPage([612, 792]);
                y = 750;
            }
            const cleanLine = allLines[i].replace(/[^\x20-\xFF]/g, ' ');
            page.drawText(cleanLine.slice(0, 105), {
                x: 40,
                y,
                size: i < 2 ? 10.5 : 9.5,
                font: i < 2 ? fontBold : font,
                color: rgb(0.08, 0.12, 0.2)
            });
            y -= 13;
        }
        return Buffer.from(await pdfDoc.save());
    }
}

async function convertAttachmentToPdfBuffer(attPath) {
    if (!attPath || !fs.existsSync(attPath)) return null;
    const ext = path.extname(attPath).toLowerCase();
    if (ext === '.pdf') {
        return fs.readFileSync(attPath);
    }
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const pngBuf = await sharp(attPath).png().toBuffer();
        const doc = await PDFDocument.create();
        const img = await doc.embedPng(pngBuf);
        const page = doc.addPage([612, 792]);
        const scale = Math.min(540 / img.width, 720 / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h });
        return Buffer.from(await doc.save());
    }
    if (ext === '.docx') {
        const rawTxt = await mammoth.extractRawText({ path: attPath });
        return await renderEmailCoverAndBodyPdf(
            { subject: path.basename(attPath), body_text: rawTxt.value || '', sender_email: 'Adjunto DOCX' },
            { ficha: '', doc_tipo: '', doc_numero: '', aprendiz_nombre: '' },
            'ANEXO DOCX CONVERTIDO A PDF'
        );
    }
    return null;
}

/**
 * Construye el PDF final (UNIFICADO / SOLO_ADJUNTO / SOLO_CORREO), lo guarda en /mnt/almacen/689224/68922437/<FICHA>/<DOC>/
 * y crea el registro en `documents` asignado a la tipología de la Historia Académica.
 */
async function buildAndAssignHistoriaPdf({
    bandejaItem,
    expedienteId,
    typologyName,
    pdfMode = 'UNIFICADO',
    documentDate = null,
    userId = null
}) {
    const expRes = await pool.query('SELECT * FROM expedientes WHERE id = $1 LIMIT 1', [expedienteId]);
    if (!expRes.rows || expRes.rows.length === 0) {
        throw new Error('No se encontró el expediente de Historia Académica seleccionado.');
    }
    const expInfo = parseExp37Meta(expRes.rows[0]);

    const attachments = Array.isArray(bandejaItem.attachments_json)
        ? bandejaItem.attachments_json
        : (() => { try { return JSON.parse(bandejaItem.attachments_json || '[]'); } catch { return []; } })();

    const validAttBuffers = [];
    for (const att of attachments) {
        if (att && att.path && fs.existsSync(att.path)) {
            const b = await convertAttachmentToPdfBuffer(att.path).catch(() => null);
            if (b) validAttBuffers.push(b);
        }
    }

    const mergedPdf = await PDFDocument.create();

    const includeCover = pdfMode === 'UNIFICADO' || pdfMode === 'SOLO_CORREO' || validAttBuffers.length === 0;
    const includeAttachments = (pdfMode === 'UNIFICADO' || pdfMode === 'SOLO_ADJUNTO') && validAttBuffers.length > 0;

    if (includeCover) {
        const coverBuf = await renderEmailCoverAndBodyPdf(bandejaItem, expInfo, typologyName);
        const coverDoc = await PDFDocument.load(coverBuf, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    if (includeAttachments) {
        for (const abuf of validAttBuffers) {
            try {
                const aDoc = await PDFDocument.load(abuf, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(aDoc, aDoc.getPageIndices());
                pages.forEach(p => mergedPdf.addPage(p));
            } catch (_) {}
        }
    }

    const pageCount = mergedPdf.getPageCount();
    const finalPdfBytes = Buffer.from(await mergedPdf.save());

    // Determinar carpeta oficial del expediente en /mnt/almacen/689224/68922437/<FICHA>/<TIPO_DOC NUM_DOC>/
    const existingDirRes = await pool.query(
        'SELECT path FROM documents WHERE expediente_id = $1 AND path IS NOT NULL ORDER BY id ASC LIMIT 1',
        [expedienteId]
    );
    let targetFolder = null;
    if (existingDirRes.rows?.[0]?.path) {
        const candDir = path.dirname(existingDirRes.rows[0].path);
        if (fs.existsSync(candDir)) targetFolder = candDir;
    }
    if (!targetFolder) {
        const safeFicha = (expInfo.ficha || 'SIN_FICHA').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeLearnerFolder = `${expInfo.doc_tipo || 'CC'} ${expInfo.doc_numero || expInfo.id}`.trim().replace(/[^a-zA-Z0-9 _-]/g, '');
        targetFolder = path.join(STORAGE_ROOT, '689224', '68922437', safeFicha, safeLearnerFolder);
    }
    fs.mkdirSync(targetFolder, { recursive: true });

    // Calcular consecutivo siguiente en el expediente
    const cntRes = await pool.query('SELECT COUNT(*)::int AS c FROM documents WHERE expediente_id = $1', [expedienteId]);
    const nextNum = String((cntRes.rows?.[0]?.c || 0) + 1).padStart(2, '0');
    const safeTypFile = normStr(typologyName)
        .replace(/[^A-Z0-9 ]/g, '')
        .trim()
        .slice(0, 72)
        .replace(/\s+/g, ' ');
    const finalFilename = `${nextNum}_${safeTypFile}.pdf`;
    const finalPath = path.join(targetFolder, finalFilename);

    fs.writeFileSync(finalPath, finalPdfBytes);

    const effDocDate = documentDate
        || (bandejaItem.email_date ? new Date(bandejaItem.email_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    const metaValues = {
        source: 'SINCRONIZACION_CORREO_HISTORIAS',
        subject: bandejaItem.subject || '',
        sender_email: bandejaItem.sender_email || '',
        radicado: bandejaItem.radicado || '',
        nis: bandejaItem.nis || '',
        ficha: expInfo.ficha,
        aprendiz_documento: expInfo.doc_numero,
        aprendiz_nombre: expInfo.aprendiz_nombre,
        pdf_mode: pdfMode
    };

    const insRes = await pool.query(`
        INSERT INTO documents (
            organization_id, trd_series_id, trd_subseries_id, expediente_id,
            filename, path, storage_path, typology_name, document_date,
            page_count, status, origen, metadata_values, user_id
        ) VALUES (
            8, 97, NULL, $1,
            $2, $3, $3, $4, $5,
            $6, 'Pendiente', 'ELECTRONICO', $7, $8
        )
        RETURNING id
    `, [
        expedienteId,
        finalFilename,
        finalPath,
        typologyName,
        effDocDate,
        pageCount,
        JSON.stringify(metaValues),
        userId || null
    ]);

    return {
        document_id: insRes.rows[0].id,
        filename: finalFilename,
        path: finalPath,
        page_count: pageCount,
        expediente: expInfo
    };
}

// ─── INTERACCIÓN SEGURA SIN BLOQUEO (< 3s) CON VISOR OUTLOOK 365 ─────────────
async function interactWithOutlookPage({ type, x, y, text, pressEnter }) {
    const page = outlookSyncState.page;
    if (!page || page.isClosed()) {
        throw new Error('No hay navegador Outlook activo. Pulse primero "Conectar y Sincronizar Correo".');
    }

    await withTimeout((async () => {
        await flushMicrosoftLoginAnimations(page);
        if (type === 'click' && typeof x === 'number' && typeof y === 'number') {
            await page.mouse.click(x, y);
        } else if (type === 'type' && text !== undefined) {
            const strVal = String(text);
            // Si estamos en pantalla de contraseña u OTP de Microsoft, enfocar automáticamente la caja visible
            const targetSelector = await page.evaluate(() => {
                const pwd = document.querySelector('input[type="password"], input[name="passwd"], #i0118');
                if (pwd && pwd.offsetParent !== null) return 'input[type="password"], input[name="passwd"], #i0118';
                const otp = document.querySelector('input[name="otc"], #idTxtBx_SAOTCC_OTC, input[type="tel"]');
                if (otp && otp.offsetParent !== null) return 'input[name="otc"], #idTxtBx_SAOTCC_OTC, input[type="tel"]';
                const em = document.querySelector('input[type="email"], input[name="loginfmt"], #i0116');
                if (em && em.offsetParent !== null) return 'input[type="email"], input[name="loginfmt"], #i0116';
                return null;
            }).catch(() => null);

            if (targetSelector) {
                await page.click(targetSelector, { clickCount: 3 }).catch(() => {});
                await page.keyboard.press('Backspace').catch(() => {});
                await page.type(targetSelector, strVal, { delay: 18 }).catch(() => {});
                if (pressEnter) {
                    await sleep(250);
                    await page.click('#idSIButton9, input[type="submit"], button[type="submit"]').catch(() => page.keyboard.press('Enter'));
                }
            } else {
                await page.keyboard.type(strVal, { delay: 18 });
                if (pressEnter) await page.keyboard.press('Enter');
            }
        }
    })(), 3200);

    await sleep(550);
    await captureOutlookFrame();
    return { lastFrame: outlookSyncState.lastFrame };
}

// ─── ESCANEO EN VIVO DE OUTLOOK 365 WEB ──────────────────────────────────────
async function startOutlookHistoriasSync({
    mailboxEmail = 'leparadam@sena.edu.co',
    password = '',
    folderName = 'Bandeja de entrada',
    searchQuery = '',
    maxMessages = 35,
    ownerUserId = null,
    forceRestart = false
}) {
    const cleanEmail = String(mailboxEmail || 'leparadam@sena.edu.co').trim().toLowerCase();

    if (outlookSyncState.isRunning) {
        if (forceRestart || outlookSyncState.status === 'waiting_auth' || outlookSyncState.status === 'error') {
            outlookSyncState.isRunning = false;
            await sleep(350);
        } else {
            return { started: false, message: 'Ya hay una sincronización de correo en ejecución.' };
        }
    }

    // Si es leparadam@sena.edu.co y envían contraseña nueva, persistirla; si no envían, reutilizar la guardada
    let effectivePass = String(password || '').trim();
    if (cleanEmail === 'leparadam@sena.edu.co') {
        try {
            if (effectivePass) {
                await pool.query(
                    `INSERT INTO system_settings (key, value) VALUES ('deserciones_email_pass', $1)
                     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                    [effectivePass]
                );
            } else {
                const pRes = await pool.query("SELECT value FROM system_settings WHERE key = 'deserciones_email_pass' LIMIT 1");
                if (pRes.rows?.[0]?.value) effectivePass = String(pRes.rows[0].value).trim();
            }
        } catch (_) {}
    }

    outlookSyncState.isRunning = true;
    outlookSyncState.status = 'running';
    outlookSyncState.mailboxEmail = cleanEmail;
    outlookSyncState.folderName = folderName;
    outlookSyncState.mfaNumber = null;
    outlookSyncState.authPrompt = null;
    outlookSyncState.logs = [];
    outlookSyncState._triedAutoPass = false;
    outlookSyncState._clickedAuthPushCount = 0;
    outlookSyncState._troubleReloadCount = 0;
    outlookSyncState._lastMfaLogged = null;
    outlookSyncState.stats = { scanned: 0, savedToInbox: 0, matched: 0, duplicates: 0 };

    // Ejecución 100% en segundo plano para responder < 50ms al cliente HTTP (nunca 504)
    (async () => {
        try {
            await ensureHistoriasCorreoSchema();
            addOutlookLog(`🚀 Conectando al buzón Outlook 365 (${cleanEmail}) — Carpeta: ${folderName}...`);
            const { page, reused } = await ensureOutlookBrowserOpen(cleanEmail);
            if (reused) {
                addOutlookLog(`🟢 Reutilizando sesión persistente activa en el servidor para ${cleanEmail}...`);
            }

            // Configurar carpeta de descarga de adjuntos
            const dlDir = path.join(INBOX_STORAGE_DIR, 'downloads_tmp');
            fs.mkdirSync(dlDir, { recursive: true });
            try {
                const client = await page.target().createCDPSession();
                await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir });
            } catch (_) {}

            const curUrl = page.url() || '';
            const isAlreadyInsideMail = /outlook\.(office|office365)\.com\/mail|outlook\.cloud\.microsoft\/mail/i.test(curUrl);
            if (!isAlreadyInsideMail) {
                addOutlookLog(`🌐 Abriendo Outlook 365 Web (https://outlook.office.com/mail/)...`);
                await page.goto('https://outlook.office.com/mail/', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                await sleep(2000);
                await flushMicrosoftLoginAnimations(page);
            }
            await captureOutlookFrame();

            // Ciclo de autenticación Microsoft 365 completo (sin bloqueo por FIDO2/KnockoutJS)
            let mailboxReady = false;
            const authDeadline = Date.now() + 300000; // Hasta 5 minutos para MFA

            while (Date.now() < authDeadline && outlookSyncState.isRunning) {
                await flushMicrosoftLoginAnimations(page);
                await captureOutlookFrame();

                const pageState = await withTimeout(page.evaluate((targetEmail) => {
                    const url = window.location.href || '';
                    const bodyTxt = document.body?.innerText || '';
                    const lowerEmail = String(targetEmail || 'leparadam@sena.edu.co').toLowerCase().trim();

                    const hasMailUi = Boolean(
                        document.querySelector('[role="tree"]') ||
                        document.querySelector('#MainModule') ||
                        document.querySelector('#topSearchInput') ||
                        document.querySelector('[data-app-section="NavigationPane"]') ||
                        document.querySelector('[data-app-section="MessageList"]') ||
                        document.querySelector('[aria-label*="Panel de carpetas" i]') ||
                        document.querySelector('[aria-label*="Folder pane" i]') ||
                        document.querySelector('button[aria-label*="Correo nuevo" i]') ||
                        document.querySelector('button[aria-label*="New mail" i]')
                    );
                    if (hasMailUi && (url.includes('outlook.office') || url.includes('outlook.cloud.microsoft'))) {
                        return { type: 'MAIL_READY', url };
                    }

                    if (/having trouble verifying your account|problemas para verificar su cuenta|try signing in again/i.test(bodyTxt)) {
                        return { type: 'MFA_TROUBLE_ERROR', url };
                    }

                    const resendLink = document.querySelector('#idA_SAOTCAS_Resend');
                    if (resendLink && resendLink.offsetParent !== null) {
                        return { type: 'MFA_RESEND', url };
                    }

                    const mfaDisplay = document.querySelector('#idRichContext_DisplaySign, #displaySign, .displaySign, [data-bind*="displaySign"]');
                    if (mfaDisplay && mfaDisplay.offsetParent !== null && mfaDisplay.innerText.trim()) {
                        return { type: 'MFA_NUMBER', number: mfaDisplay.innerText.trim(), url };
                    }

                    const otpInput = document.querySelector('input[name="otc"], #idTxtBx_SAOTCC_OTC, input[type="tel"]');
                    if (otpInput && otpInput.offsetParent !== null) {
                        return { type: 'MFA_OTP', url };
                    }

                    const primaryBtn = document.querySelector('#idSIButton9');
                    const landingTitle = document.querySelector('#landingTitle, #heading, [role="heading"]');
                    const titleTxt = (landingTitle ? landingTitle.innerText : '') || '';
                    if (
                        primaryBtn &&
                        primaryBtn.offsetParent !== null &&
                        (/suspicious activity|actividad sospechosa|unusual about this sign-in|before you can continue, we need to verify/i.test(bodyTxt) ||
                         /suspicious activity|actividad sospechosa/i.test(titleTxt) ||
                         /^verify$|^verificar$/i.test((primaryBtn.value || primaryBtn.innerText || '').trim()))
                    ) {
                        return { type: 'SUSPICIOUS_ACTIVITY_VERIFY', url };
                    }

                    const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                    const usePwdOption = clickables.find(el =>
                        el.offsetParent !== null &&
                        /use my password|usar mi contrase|usar contrase|iniciar sesi[oó]n con contrase/i.test(el.innerText || '')
                    );
                    if (usePwdOption) {
                        return { type: 'CHOOSE_USE_PASSWORD', url };
                    }

                    const passInput = document.querySelector('input[type="password"], input[name="passwd"], #i0118');
                    if (passInput && passInput.offsetParent !== null) {
                        const errEl = document.querySelector('#passwordError, .error');
                        return { type: 'NEED_PASSWORD', url, error: errEl ? errEl.innerText.trim() : '' };
                    }

                    const authPushOption = clickables.find(el =>
                        el.offsetParent !== null &&
                        /approve a request on my microsoft authenticator|aprobar una solicitud en mi aplicaci[oó]n microsoft authenticator/i.test(el.innerText || '')
                    );
                    if (authPushOption && /verify your identity|verificar su identidad|comprobar su identidad/i.test(bodyTxt)) {
                        return { type: 'CHOOSE_MFA_METHOD', url };
                    }

                    const emailInput = document.querySelector('input[type="email"], input[name="loginfmt"], #i0116');
                    if (emailInput && emailInput.offsetParent !== null) {
                        return { type: 'NEED_EMAIL', url };
                    }

                    const kmsiBtn = document.querySelector('#idSIButton9, button[type="submit"]');
                    if (kmsiBtn && kmsiBtn.offsetParent !== null && /mantener la sesi[oó]n|stay signed in/i.test(bodyTxt)) {
                        return { type: 'KMSI_PROMPT', url };
                    }

                    const otherTile = document.querySelector('#otherTile');
                    const accountTile =
                        document.querySelector(`[data-test-id="${lowerEmail}"]`) ||
                        Array.from(document.querySelectorAll('#tilesHolder .table, #tilesHolder [role="listitem"], #tilesHolder [role="button"]')).find(
                            el => el.offsetParent !== null && el.id !== 'otherTile' && (el.innerText || '').toLowerCase().includes(lowerEmail)
                        );
                    const hasAccountTile = Boolean(accountTile && accountTile.offsetParent !== null);
                    const hasOtherTile = Boolean(otherTile && otherTile.offsetParent !== null);
                    if (hasAccountTile || hasOtherTile) {
                        return { type: 'PICK_ACCOUNT', hasAccountTile, hasOtherTile, url };
                    }

                    if (url.includes('/bridge/fido') || /face, fingerprint, pin or security key|rostro, huella digital, pin/i.test(bodyTxt)) {
                        return { type: 'FIDO_BRIDGE', url };
                    }

                    return { type: 'LOADING', url };
                }, cleanEmail), 3000, { type: 'LOADING', url: '' });

                if (pageState.type === 'MAIL_READY') {
                    mailboxReady = true;
                    outlookSyncState.status = 'running';
                    outlookSyncState.mfaNumber = null;
                    outlookSyncState.authPrompt = null;
                    addOutlookLog(`✅ Buzón Outlook 365 autenticado y activo (${cleanEmail}).`);
                    break;
                }

                if (pageState.type === 'MFA_TROUBLE_ERROR' && outlookSyncState._troubleReloadCount < 3) {
                    outlookSyncState._troubleReloadCount++;
                    outlookSyncState._clickedAuthPushCount = 0;
                    outlookSyncState._triedAutoPass = false;
                    addOutlookLog(`🔄 Sesión previa expirada; reabriendo Outlook 365...`);
                    await page.goto('https://outlook.office.com/mail/', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                    await sleep(2200);
                    continue;
                }

                if (pageState.type === 'SUSPICIOUS_ACTIVITY_VERIFY') {
                    addOutlookLog(`🛡️ Confirmando verificación de seguridad de Microsoft...`);
                    await page.evaluate(() => {
                        const btn = document.querySelector('#idSIButton9, input[type="submit"], button[type="submit"]');
                        if (btn) btn.click();
                    }).catch(() => {});
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'FIDO_BRIDGE') {
                    addOutlookLog(`⚡ Omitiendo PIN / Windows Hello para pasar directo a Contraseña / Authenticator...`);
                    await sleep(1500);
                    continue;
                }

                if (pageState.type === 'CHOOSE_USE_PASSWORD') {
                    addOutlookLog(`🔑 Seleccionando automáticamente "Usar mi contraseña"...`);
                    await page.evaluate(() => {
                        const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                        const usePwd = clickables.find(el =>
                            el.offsetParent !== null &&
                            /use my password|usar mi contrase|usar contrase|iniciar sesi[oó]n con contrase/i.test(el.innerText || '')
                        );
                        if (usePwd) usePwd.click();
                    }).catch(() => {});
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'PICK_ACCOUNT') {
                    if (pageState.hasAccountTile) {
                        addOutlookLog(`👤 Seleccionando cuenta institucional guardada ${cleanEmail}...`);
                        await page.evaluate((targetEmail) => {
                            const lowerEmail = String(targetEmail || '').toLowerCase().trim();
                            const tile =
                                document.querySelector(`[data-test-id="${lowerEmail}"] .table`) ||
                                document.querySelector(`[data-test-id="${lowerEmail}"]`) ||
                                Array.from(document.querySelectorAll('#tilesHolder .table, #tilesHolder [role="listitem"], #tilesHolder [role="button"]')).find(
                                    el => el.offsetParent !== null && el.id !== 'otherTile' && (el.innerText || '').toLowerCase().includes(lowerEmail)
                                );
                            if (tile) tile.click();
                        }, cleanEmail).catch(() => {});
                    } else if (pageState.hasOtherTile) {
                        await page.click('#otherTile').catch(() => {});
                    }
                    await sleep(2000);
                    continue;
                }

                if (pageState.type === 'NEED_EMAIL' && cleanEmail) {
                    addOutlookLog(`✉️ Ingresando correo institucional ${cleanEmail}...`);
                    await page.click('input[type="email"], input[name="loginfmt"], #i0116', { clickCount: 3 }).catch(() => {});
                    await page.keyboard.press('Backspace').catch(() => {});
                    await page.type('input[type="email"], input[name="loginfmt"], #i0116', cleanEmail, { delay: 22 }).catch(() => {});
                    await sleep(350);
                    await page.click('#idSIButton9, input[type="submit"], button[type="submit"]').catch(() => page.keyboard.press('Enter'));
                    await sleep(3500);
                    continue;
                }

                if (pageState.type === 'NEED_PASSWORD') {
                    if (effectivePass && !outlookSyncState._triedAutoPass) {
                        outlookSyncState._triedAutoPass = true;
                        addOutlookLog(`🔑 Ingresando contraseña de ${cleanEmail}...`);
                        await page.click('input[type="password"], input[name="passwd"], #i0118', { clickCount: 3 }).catch(() => {});
                        await page.keyboard.press('Backspace').catch(() => {});
                        await page.type('input[type="password"], input[name="passwd"], #i0118', effectivePass, { delay: 22 }).catch(() => {});
                        await sleep(350);
                        await page.click('#idSIButton9, input[type="submit"], button[type="submit"]').catch(() => page.keyboard.press('Enter'));
                        await sleep(2800);
                        continue;
                    } else {
                        outlookSyncState.status = 'waiting_auth';
                        outlookSyncState.authPrompt = pageState.error
                            ? `Microsoft reportó: "${pageState.error}". Escriba su contraseña en la barra inferior y pulse Enviar.`
                            : `Escriba la contraseña de ${cleanEmail} en la barra inferior del visor y pulse Enviar.`;
                        await sleep(1800);
                        continue;
                    }
                }

                if (pageState.type === 'CHOOSE_MFA_METHOD' && outlookSyncState._clickedAuthPushCount < 3) {
                    outlookSyncState._clickedAuthPushCount++;
                    addOutlookLog(`📲 Solicitando código de aprobación en Microsoft Authenticator...`);
                    await page.evaluate(() => {
                        const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                        const authPush = clickables.find(el =>
                            el.offsetParent !== null &&
                            /approve a request on my microsoft authenticator|aprobar una solicitud en mi aplicaci[oó]n microsoft authenticator/i.test(el.innerText || '')
                        );
                        if (authPush) authPush.click();
                    }).catch(() => {});
                    await sleep(2000);
                    continue;
                }

                if (pageState.type === 'MFA_RESEND') {
                    addOutlookLog(`🔄 Renovando solicitud de número en Microsoft Authenticator...`);
                    await page.click('#idA_SAOTCAS_Resend').catch(() => {});
                    await sleep(2200);
                    continue;
                }

                if (pageState.type === 'MFA_NUMBER') {
                    outlookSyncState.status = 'waiting_auth';
                    outlookSyncState.mfaNumber = pageState.number;
                    outlookSyncState.authPrompt = `Apruebe en Microsoft Authenticator el número: ${pageState.number}`;
                    await page.evaluate(() => {
                        const chk = document.querySelector('#idChkBx_SAOTCAS_TD, input[type="checkbox"]');
                        if (chk && !chk.checked) chk.click();
                    }).catch(() => {});
                    if (outlookSyncState._lastMfaLogged !== pageState.number) {
                        outlookSyncState._lastMfaLogged = pageState.number;
                        addOutlookLog(`📲 [CÓDIGO #${pageState.number}] Apruebe el número ${pageState.number} en su celular (Microsoft Authenticator).`);
                    }
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'MFA_OTP') {
                    outlookSyncState.status = 'waiting_auth';
                    outlookSyncState.authPrompt = 'Escriba el código de verificación de 6 dígitos en la barra inferior del visor y pulse Enviar.';
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'KMSI_PROMPT') {
                    addOutlookLog(`💾 Confirmando "Mantener la sesión iniciada" en el servidor...`);
                    await page.evaluate(() => {
                        const chk = document.querySelector('#KmsiCheckboxField, input[type="checkbox"]');
                        if (chk && !chk.checked) chk.click();
                        const yesBtn = document.querySelector('#idSIButton9, button[type="submit"], input[type="submit"]');
                        if (yesBtn) yesBtn.click();
                    }).catch(() => {});
                    await sleep(3000);
                    continue;
                }

                await sleep(1600);
            }

            if (!mailboxReady) {
                throw new Error('Tiempo de espera agotado esperando aprobación en Outlook 365. El visor sigue abierto para completar el ingreso.');
            }

            // Seleccionar carpeta solicitada
            if (folderName) {
                const clickedFolder = await page.evaluate((targetFolder) => {
                    const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                    const tf = norm(targetFolder);
                    const aliases = tf.includes('enviad') ? ['elementos enviados', 'sent items', 'enviados']
                        : tf.includes('producid') ? ['producidas']
                        : [tf, 'bandeja de entrada', 'inbox'];
                    const treeItems = Array.from(document.querySelectorAll('[role="treeitem"], [data-folder-name]'));
                    const match = treeItems.find(el => {
                        const t = norm(el.getAttribute('data-folder-name') || el.getAttribute('title') || el.innerText || '');
                        return aliases.some(a => t === a || t.startsWith(a + ' '));
                    });
                    if (match) { match.click(); return true; }
                    return false;
                }, folderName);
                if (clickedFolder) {
                    addOutlookLog(`📂 Carpeta "${folderName}" abierta.`);
                    await sleep(2500);
                }
            }

            // Si hay filtro de búsqueda en Outlook
            if (searchQuery && String(searchQuery).trim()) {
                const sq = String(searchQuery).trim();
                const searchInput = await page.$('#topSearchInput, input[aria-label*="Buscar" i], input[aria-label*="Search" i]');
                if (searchInput) {
                    addOutlookLog(`🔎 Buscando en Outlook: "${sq}"...`);
                    await searchInput.click({ clickCount: 3 });
                    await page.keyboard.type(sq, { delay: 18 });
                    await page.keyboard.press('Enter');
                    await sleep(3200);
                }
            }

            const [typologies, historiasIdx] = await Promise.all([
                getOfficial37Typologies(),
                loadHistoriasIndex()
            ]);

            const limit = Math.min(80, Math.max(5, parseInt(maxMessages, 10) || 30));
            const seenUidsInRun = new Set();

            for (let idx = 0; idx < limit && outlookSyncState.isRunning; idx++) {
                const clickedMsg = await page.evaluate((targetIdx) => {
                    const items = Array.from(document.querySelectorAll('[role="option"][data-convid], [role="listbox"] [role="option"]'));
                    if (targetIdx >= items.length) return null;
                    const el = items[targetIdx];
                    el.scrollIntoView({ block: 'center' });
                    el.click();
                    return {
                        convId: el.getAttribute('data-convid') || '',
                        aria: (el.getAttribute('aria-label') || el.innerText || '').slice(0, 260)
                    };
                }, idx);

                if (!clickedMsg) {
                    // Intentar hacer scroll para cargar más mensajes
                    const moreCount = await page.evaluate(() => {
                        const lb = document.querySelector('[role="listbox"]');
                        if (lb) lb.scrollTop += 600;
                        return document.querySelectorAll('[role="option"]').length;
                    });
                    await sleep(1500);
                    if (idx >= moreCount) break;
                    continue;
                }

                await sleep(1600);
                await captureOutlookFrame();

                const pane = await page.evaluate(() => {
                    const rp =
                        document.querySelector('#ReadingPaneContainerId') ||
                        document.querySelector('[data-app-section="ReadingPane"]') ||
                        document.querySelector('[data-app-section="ConversationContainer"]');
                    if (!rp) return null;
                    const subj =
                        (rp.querySelector('[role="heading"][aria-level="2"]')?.innerText || '').trim() ||
                        (document.querySelector('[role="heading"][aria-level="2"]')?.innerText || '').trim();
                    const fullText = rp.innerText || '';
                    const fullHtml = rp.innerHTML || '';
                    const emails = Array.from(new Set((fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase())));
                    const dateEl = rp.querySelector('time[datetime]');
                    const isoDate = dateEl ? dateEl.getAttribute('datetime') : null;
                    return {
                        subject: subj,
                        bodyText: fullText,
                        bodyHtml: fullHtml,
                        emails,
                        isoDate
                    };
                }).catch(() => null);

                if (!pane || (!pane.subject && !pane.bodyText)) continue;

                outlookSyncState.stats.scanned++;
                const rawHash = crypto
                    .createHash('sha256')
                    .update(`${pane.subject}|${(pane.bodyText || '').slice(0, 1200)}`)
                    .digest('hex')
                    .slice(0, 24);
                const messageUid = `OWA-${rawHash}`;
                if (seenUidsInRun.has(messageUid)) continue;
                seenUidsInRun.add(messageUid);

                // Intentar descargar adjuntos visibles si tiene botón "Descargar" / "Download"
                const savedAttachments = [];
                try {
                    for (const f of fs.readdirSync(dlDir)) {
                        try { fs.unlinkSync(path.join(dlDir, f)); } catch (_) {}
                    }
                    const hasDownloadBtn = await page.evaluate(() => {
                        const rp = document.querySelector('#ReadingPaneContainerId') || document;
                        const dlBtns = Array.from(rp.querySelectorAll('button, [role="menuitem"], a'));
                        const dAll = dlBtns.find(b => /descargar todo|download all|^descargar$|^download$/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
                        if (dAll) { dAll.click(); return true; }
                        return false;
                    });
                    if (hasDownloadBtn) {
                        await sleep(2400);
                        const dlFiles = fs.readdirSync(dlDir).filter(f => !f.endsWith('.crdownload'));
                        for (const fn of dlFiles) {
                            const src = path.join(dlDir, fn);
                            const dstDir = path.join(INBOX_STORAGE_DIR, messageUid);
                            fs.mkdirSync(dstDir, { recursive: true });
                            const dst = path.join(dstDir, fn);
                            fs.renameSync(src, dst);
                            let extractedPdfText = '';
                            if (pdfParse && fn.toLowerCase().endsWith('.pdf')) {
                                try {
                                    const parsedPdf = await pdfParse(fs.readFileSync(dst));
                                    extractedPdfText = parsedPdf?.text || '';
                                } catch (_) {}
                            }
                            savedAttachments.push({ filename: fn, path: dst, textSnippet: extractedPdfText.slice(0, 1500) });
                        }
                    }
                } catch (_) {}

                const attText = savedAttachments.map(a => `${a.filename} ${a.textSnippet || ''}`).join('\n');
                const combinedForMatch = `${pane.subject}\n${pane.bodyText}\n${attText}`;

                const matchInfo = matchTextAgainstHistoriasIndex(combinedForMatch, historiasIdx);
                const typInfo = classifyHistoriaTypology(`${pane.subject}\n${attText}\n${pane.bodyText.slice(0, 2000)}`, typologies);

                const senderEmail = pane.emails[0] || mailboxEmail;
                const recipientEmails = pane.emails.slice(1).join(', ');
                const defaultPdfMode = savedAttachments.some(a => a.filename.toLowerCase().endsWith('.pdf')) ? 'UNIFICADO' : 'SOLO_CORREO';

                const ins = await pool.query(`
                    INSERT INTO historias_correo_bandeja (
                        owner_user_id, mailbox_email, folder_name, message_uid,
                        subject, sender_email, recipient_emails, email_date,
                        radicado, nis, body_text, body_html, attachments_json,
                        detected_doc_tipo, detected_doc_numero, detected_ficha, detected_aprendiz_nombre,
                        matched_expediente_id, candidate_expedientes_json, match_confidence,
                        suggested_stage, suggested_typology_id, suggested_typology_name, pdf_mode
                    ) VALUES (
                        $1, $2, $3, $4,
                        $5, $6, $7, $8,
                        $9, $10, $11, $12, $13,
                        $14, $15, $16, $17,
                        $18, $19, $20,
                        $21, $22, $23, $24
                    )
                    ON CONFLICT (message_uid) DO NOTHING
                    RETURNING id
                `, [
                    ownerUserId || null,
                    mailboxEmail,
                    folderName,
                    messageUid,
                    pane.subject || '(Sin asunto)',
                    senderEmail,
                    recipientEmails,
                    pane.isoDate ? new Date(pane.isoDate).toISOString() : new Date().toISOString(),
                    matchInfo.radicado || null,
                    matchInfo.nis || null,
                    pane.bodyText || '',
                    pane.bodyHtml || '',
                    JSON.stringify(savedAttachments.map(a => ({ filename: a.filename, path: a.path }))),
                    matchInfo.detected_doc_tipo,
                    matchInfo.detected_doc_numero,
                    matchInfo.detected_ficha,
                    matchInfo.detected_aprendiz_nombre,
                    matchInfo.matchedExp?.id || null,
                    JSON.stringify(matchInfo.candidates || []),
                    matchInfo.confidence,
                    typInfo.stage,
                    typInfo.typology_id,
                    typInfo.typology_name,
                    defaultPdfMode
                ]);

                if (ins.rows && ins.rows.length > 0) {
                    outlookSyncState.stats.savedToInbox++;
                    if (matchInfo.matchedExp) {
                        outlookSyncState.stats.matched++;
                        addOutlookLog(`🎯 Correo vinculado -> ${matchInfo.detected_aprendiz_nombre} (Ficha ${matchInfo.detected_ficha}) · [${typInfo.typology_name.slice(0, 42)}...]`);
                    } else {
                        addOutlookLog(`📩 Correo guardado en bandeja para asignación manual: "${(pane.subject || '').slice(0, 55)}"`);
                    }
                } else {
                    outlookSyncState.stats.duplicates++;
                }
            }

            outlookSyncState.status = 'completed';
            addOutlookLog(`🎉 Sincronización finalizada: ${outlookSyncState.stats.scanned} escaneados, ${outlookSyncState.stats.savedToInbox} nuevos (${outlookSyncState.stats.matched} cruzados con Historias Académicas).`);
        } catch (err) {
            outlookSyncState.status = 'error';
            addOutlookLog(`❌ Error: ${err.message}`);
        } finally {
            outlookSyncState.isRunning = false;
            await captureOutlookFrame();
        }
    })();

    return { started: true, message: 'Sincronización iniciada.' };
}

module.exports = {
    ensureHistoriasCorreoSchema,
    getOfficial37Typologies,
    classifyHistoriaTypology,
    parseExp37Meta,
    loadHistoriasIndex,
    matchTextAgainstHistoriasIndex,
    buildAndAssignHistoriaPdf,
    renderEmailCoverAndBodyPdf,
    startOutlookHistoriasSync,
    interactWithOutlookPage,
    sendEmailViaOutlookWeb,
    outlookSyncState,
    captureOutlookFrame,
    INBOX_STORAGE_DIR
};
