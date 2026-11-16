const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database_pg');

// Correos internos/institucionales de CC que NO deben confundirse con el destinatario (Para:) del aprendiz
const INTERNAL_CC_EMAILS = new Set([
    'grupoadmondocumentos@sena.edu.co',
    'leparadam@sena.edu.co',
    'mevalencia@sena.edu.co',
    'mlgomez@sena.edu.co',
    'admartinezr@sena.edu.co',
    'nramirezd@sena.edu.co',
    'lidymayarysh@hotmail.com',
    'jhoananaya126@gmail.com',
    'edhernandezm@sena.edu.co',
    'tvillamizarj@sena.edu.co',
    'tvillamizar@sena.edu.co',
    'desercionescimi@sena.edu.co',
    'jrrozo@sena.edu.co',
    'deserciones9224@sena.edu.co'
]);

// Estado global independiente para el sincronizador de correo Outlook 365 (Carpeta Producidas)
// El navegador (browser/page) se mantiene ABIERTO permanentemente en el servidor para no pedir clave/MFA cada vez.
const emailSyncState = {
    isRunning: false,
    jobId: null,
    status: 'idle', // 'idle' | 'running' | 'waiting_auth' | 'completed' | 'error'
    mfaNumber: null,
    authPrompt: null,
    currentUrl: '',
    logs: [],
    stats: {
        emailsScanned: 0,
        cpeFound: 0,
        matchedUpdated: 0,
        alreadyUpdated: 0,
        unmatchedCount: 0,
        unmatchedList: []
    },
    updatedRecords: [],
    lastFrame: null,
    browser: null,
    page: null,
    frameTimer: null,
    interceptedItems: []
};

const addSyncLog = (msg) => {
    const line = `[${new Date().toLocaleTimeString('es-CO')}] ${msg}`;
    console.log(`[DESERCIONES-EMAIL-SYNC] ${line}`);
    emailSyncState.logs.push(line);
    if (emailSyncState.logs.length > 400) {
        emailSyncState.logs.shift();
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const flushMicrosoftLoginAnimations = async (page) => {
    if (!page || page.isClosed()) return;
    try {
        await page.evaluate(() => {
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
        });
    } catch (_) {}
};

const captureFrame = async () => {
    if (!emailSyncState.page || emailSyncState._capturing) return;
    emailSyncState._capturing = true;
    try {
        if (emailSyncState.page.isClosed()) return;
        // Cerrar pestañas secundarias de soporte que quitan el foco a la pestaña de login/correo
        if (emailSyncState.browser) {
            try {
                const pages = await emailSyncState.browser.pages();
                if (pages.length > 1) {
                    for (const p of pages) {
                        if (p !== emailSyncState.page && /support\.microsoft\.com|aka\.ms/i.test(p.url() || '')) {
                            await p.close().catch(() => {});
                        }
                    }
                    await emailSyncState.page.bringToFront().catch(() => {});
                }
            } catch (_) {}
        }
        emailSyncState.currentUrl = emailSyncState.page.url();
        if (/login\.microsoftonline\.com|login\.live\.com/i.test(emailSyncState.currentUrl)) {
            await flushMicrosoftLoginAnimations(emailSyncState.page);
        }
        const b64 = await Promise.race([
            emailSyncState.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 68 }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('screenshot_timeout')), 2500))
        ]);
        if (b64) emailSyncState.lastFrame = `data:image/jpeg;base64,${b64}`;
    } catch (_) {
    } finally {
        emailSyncState._capturing = false;
    }
};

const ensureContinuousFrameCapture = () => {
    if (emailSyncState.frameTimer) clearInterval(emailSyncState.frameTimer);
    emailSyncState.frameTimer = setInterval(async () => {
        if (!emailSyncState.isRunning && emailSyncState.page && !emailSyncState.page.isClosed()) {
            try {
                await captureFrame();
                // Mantener actualizado el número de Authenticator o estado de buzón incluso en modo pasivo
                const liveInfo = await emailSyncState.page.evaluate(() => {
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
                }).catch(() => null);
                if (liveInfo) {
                    if (liveInfo.mfaNum) {
                        emailSyncState.mfaNumber = liveInfo.mfaNum;
                        emailSyncState.status = 'waiting_auth';
                        emailSyncState.authPrompt = `Marque el número ${liveInfo.mfaNum} en la app Microsoft Authenticator de su celular.`;
                    } else if (liveInfo.hasMail && emailSyncState.status === 'waiting_auth') {
                        emailSyncState.mfaNumber = null;
                        emailSyncState.authPrompt = null;
                        emailSyncState.status = 'completed';
                    }
                }
            } catch (_) {}
        }
    }, 1800);
};

/**
 * Extrae Radicado, N.I.S., Fecha, Para (destinatario), Ficha y Etapa de un correo CPE de OnBase
 */
function parseRawCpeEmail(rawItem = {}) {
    const subject = String(rawItem.subject || '').trim();
    const bodyText = String(rawItem.bodyText || '').trim();
    const bodyHtml = String(rawItem.bodyHtml || '').trim();
    const headerText = String(rawItem.headerText || '').trim();
    const attachmentText = String(rawItem.attachmentText || '').trim();
    const combinedText = `${subject}\n${headerText}\n${bodyText}\n${attachmentText}`;

    // 1. Extraer Radicado (ej: 68-9-2026-057099)
    let radicado = String(rawItem.radicado || '').trim();
    if (!radicado) {
        const mSub = subject.match(/CPE\s*No\.?\s*(\d{2}-\d-\d{4}-\d{4,8})/i)
            || combinedText.match(/\b(\d{2}-9-\d{4}-\d{4,8})\b/i)
            || combinedText.match(/\b(\d{2}-\d{1,2}-20\d{2}-\d{4,8})\b/);
        if (mSub) radicado = mSub[1].trim();
    }

    // 2. Extraer N.I.S. (ej: 2026-02-499770)
    let nis = String(rawItem.nis || '').trim();
    if (!nis) {
        const mNis = combinedText.match(/\b(20\d{2}-\d{2}-\d{4,9})\b/);
        if (mNis) nis = mNis[1].trim();
    }

    // 3. Extraer Fecha de Radicado (ej: 11/4/2026 8:53:03 AM)
    let fechaRadicado = String(rawItem.fecha_radicado || rawItem.fecha || '').trim();
    if (!fechaRadicado) {
        const mFecha = combinedText.match(/\b(\d{1,2}\/\d{1,2}\/20\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]\.?M\.?|a\.?\s*m\.?|p\.?\s*m\.?)?)\b/i);
        if (mFecha) fechaRadicado = mFecha[1].replace(/\s+/g, ' ').trim();
    }

    // 3.1 Si hay HTML con tabla Radicado | N.I.S. | Fecha, extraer con prioridad exacta
    if (bodyHtml && (!radicado || !nis || !fechaRadicado)) {
        const strippedRows = [];
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        while ((trMatch = trRegex.exec(bodyHtml)) !== null) {
            const cells = [];
            const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
            let tdMatch;
            while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
                const cellTxt = tdMatch[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                cells.push(cellTxt);
            }
            if (cells.length >= 3) strippedRows.push(cells);
        }
        for (let i = 0; i < strippedRows.length; i++) {
            const r = strippedRows[i];
            if (/radicado/i.test(r[0]) && /n\.?i\.?s/i.test(r[1]) && i + 1 < strippedRows.length) {
                const valRow = strippedRows[i + 1];
                if (valRow[0] && /\d{2}-/.test(valRow[0])) radicado = valRow[0];
                if (valRow[1] && /20\d{2}-/.test(valRow[1])) nis = valRow[1];
                if (valRow[2] && /\d+\/\d+\/20\d{2}/.test(valRow[2])) fechaRadicado = valRow[2];
                break;
            }
            if (/\b\d{2}-9-\d{4}-\d{4,8}\b/.test(r[0]) && /\b20\d{2}-\d{2}-\d{4,9}\b/.test(r[1])) {
                radicado = r[0];
                nis = r[1];
                if (r[2]) fechaRadicado = r[2];
                break;
            }
        }
    }

    // 4. Extraer destinatarios Para: (To)
    const candidateEmails = [];
    const addEmailCandidate = (em) => {
        if (!em) return;
        const matches = String(em).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const m of matches) {
            const clean = m.trim().toLowerCase();
            if (clean && !INTERNAL_CC_EMAILS.has(clean) && !candidateEmails.includes(clean)) {
                candidateEmails.push(clean);
            }
        }
    };

    if (Array.isArray(rawItem.toEmails)) {
        rawItem.toEmails.forEach(addEmailCandidate);
    } else if (rawItem.to) {
        addEmailCandidate(rawItem.to);
    }

    // Buscar explícitamente línea "Para: ..." o "To: ..." antes de "CC:"
    let paraRawLine = String(rawItem.paraLine || '').trim();
    const paraMatch = `${headerText}\n${bodyText}`.match(/(?:Para|To)\s*:\s*([^\r\n]+?)(?=\r|\n|\s+CC\s*:|\s+Retenci[oó]n|\s+Retention|$)/i);
    if (paraMatch && paraMatch[1]) {
        paraRawLine = paraMatch[1].trim();
        addEmailCandidate(paraRawLine);
    }

    // 5. Extraer Ficha del asunto o cuerpo (ej: FICHA 3491179)
    let ficha = String(rawItem.ficha || '').trim();
    if (!ficha) {
        const mFicha = subject.match(/FICHA\s*[:#¿?\-\s]*(\d{5,10})/i)
            || combinedText.match(/FICHA\s*[:#¿?\-\s]*(\d{5,10})/i);
        if (mFicha) ficha = mFicha[1].trim();
    }

    // 6. Detectar Etapa (CITACION_COMITE vs NOTIFICACION_RESOLUCION vs NOTIFICACION_APRENDIZ)
    let etapa = rawItem.etapa || null;
    if (!etapa) {
        if (/DEPURACI[OÓ]N|POR\s+CERTIFICAR|ACCIONES\s+DE\s+FORMACI[OÓ]N|NOTIFICACI[OÓ]N\s+APRENDIZ/i.test(`${subject} ${combinedText}`)) {
            etapa = 'NOTIFICACION_APRENDIZ';
        } else if (/CITACI[OÓ]N\s+A\s+COMIT[EÉ]|PRESUNTA\s+DESERCI[OÓ]N/i.test(subject)) {
            etapa = 'CITACION_COMITE';
        } else if (/RESOLUCI[OÓ]N/i.test(subject)) {
            etapa = 'NOTIFICACION_RESOLUCION';
        }
    }

    // 7. Extraer documento de identidad si aparece en el adjunto o texto
    let docNumero = String(rawItem.aprendiz_doc_numero || '').trim();
    if (!docNumero && attachmentText) {
        const mDoc = attachmentText.match(/(?:CC|TI|CE|PPT|PEP|NIP|DOCUMENTO|IDENTIFICACI[OÓ]N)\s*(?:No\.?|N[°º]|[:#-\s])*\s*(\d{6,12})/i);
        if (mDoc) docNumero = mDoc[1].trim();
    }

    // 8. Extraer nombre exacto del aprendiz del chip de adjunto OnBase: C.I.(FRM)-9-2026-058484-(68)---NOMBRE APRENDIZ-ACCIONES...
    let aprendizNombreAdjunto = String(rawItem.aprendiz_nombre_adjunto || '').trim();
    if (!aprendizNombreAdjunto) {
        const mAttName = combinedText.match(/C\.I\.\(FRM\)-\d+-20\d{2}-\d+-\(\d+\)---(.+?)-(?:ACCIONES|CITACI|NOTIFICACI|RESOLUCI|COMUNICACI)/i);
        if (mAttName && mAttName[1]) {
            aprendizNombreAdjunto = mAttName[1].trim();
        }
    }

    return {
        radicado,
        nis,
        fecha_radicado: fechaRadicado,
        toEmails: candidateEmails,
        paraRawLine,
        ficha,
        etapa,
        aprendiz_doc_numero: docNumero,
        aprendiz_nombre_adjunto: aprendizNombreAdjunto,
        subject
    };
}

/**
 * Cruza una lista de correos CPE extraídos contra deserciones_casos y actualiza radicado, nis y fecha_radicado
 */
async function syncExtractedEmailsWithDatabase(rawItems = [], options = {}) {
    const parsedItems = rawItems
        .map(parseRawCpeEmail)
        .filter(item => item.radicado && /\d{2}-\d-\d{4}-\d+/.test(item.radicado));

    // Deduplicar por número de radicado conservando el que tenga más metadatos (nis, fecha, toEmails)
    const byRadicado = new Map();
    for (const it of parsedItems) {
        const prev = byRadicado.get(it.radicado);
        if (!prev) {
            byRadicado.set(it.radicado, it);
        } else {
            byRadicado.set(it.radicado, {
                ...prev,
                nis: prev.nis || it.nis,
                fecha_radicado: prev.fecha_radicado || it.fecha_radicado,
                ficha: prev.ficha || it.ficha,
                etapa: prev.etapa || it.etapa,
                aprendiz_doc_numero: prev.aprendiz_doc_numero || it.aprendiz_doc_numero,
                aprendiz_nombre_adjunto: prev.aprendiz_nombre_adjunto || it.aprendiz_nombre_adjunto,
                paraRawLine: prev.paraRawLine || it.paraRawLine,
                toEmails: prev.toEmails.length >= it.toEmails.length ? prev.toEmails : it.toEmails,
                subject: prev.subject || it.subject
            });
        }
    }

    // Ordenar radicados cronológicamente en orden ascendente (ej. 68-9-2026-057098, 68-9-2026-057099, ...)
    const sortedEmails = Array.from(byRadicado.values()).sort((a, b) =>
        a.radicado.localeCompare(b.radicado, undefined, { numeric: true })
    );

    // Cargar todos los casos de deserciones ordenados por fecha de lote más reciente primero y orden de fila ascendente dentro del lote
    const dbRes = await pool.query(`
        SELECT id, etapa, ficha, aprendiz_doc_tipo, aprendiz_doc_numero, aprendiz_nombre,
               aprendiz_correo, status, radicado, nis, fecha_radicado, lote_id, archivo_excel,
               raw_row, enviado_at, created_at
        FROM deserciones_casos
        ORDER BY DATE(COALESCE(enviado_at, created_at)) DESC, id ASC
    `);
    const allCases = (dbRes.rows || []).map(c => {
        const fallbackDoc = String(
            c.aprendiz_doc_numero ||
            c.raw_row?.NIP ||
            c.raw_row?.nip ||
            c.raw_row?.DOCUMENTO ||
            c.raw_row?.NUM_DOCUMENTO ||
            ''
        ).trim();
        return {
            ...c,
            aprendiz_doc_numero: fallbackDoc
        };
    });
    const usedCaseIds = new Set();

    // Marcar casos que ya tienen uno de estos radicados asignados
    for (const c of allCases) {
        if (c.radicado && byRadicado.has(String(c.radicado).trim())) {
            usedCaseIds.add(c.id);
        }
    }

    const normStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

    const getEmailDateParts = (fechaStr) => {
        const m = String(fechaStr || '').match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
        if (!m) return null;
        const a = Number(m[1]);
        const b = Number(m[2]);
        const y = Number(m[3]);
        return { a, b, y };
    };

    const caseMatchesEmailDate = (c, emailDateParts) => {
        if (!emailDateParts) return false;
        const ts = c.enviado_at || c.created_at;
        if (!ts) return false;
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return false;
        const cy = d.getFullYear();
        const cm = d.getMonth() + 1;
        const cd = d.getDate();
        return cy === emailDateParts.y && (
            (cm === emailDateParts.a && cd === emailDateParts.b) ||
            (cd === emailDateParts.a && cm === emailDateParts.b)
        );
    };

    const findBestCandidate = (predicate) => {
        const candidates = allCases.filter(predicate);
        if (candidates.length === 0) return null;
        return candidates[0];
    };

    const updatedRecords = [];
    let alreadyUpdated = 0;
    const unmatchedList = [];

    for (const emailItem of sortedEmails) {
        const emailDateParts = getEmailDateParts(emailItem.fecha_radicado);

        // Priorizar casos cuya fecha de envío/creación coincida con la fecha del correo CPE, manteniendo orden id ASC dentro del lote
        const findPrioritized = (basePredicate, checkEtapa = true) => {
            if (emailDateParts) {
                const byDateAndEtapa = findBestCandidate(c => basePredicate(c) && (!checkEtapa || !emailItem.etapa || c.etapa === emailItem.etapa) && caseMatchesEmailDate(c, emailDateParts));
                if (byDateAndEtapa) return byDateAndEtapa;
            }
            const byEtapa = findBestCandidate(c => basePredicate(c) && (!checkEtapa || !emailItem.etapa || c.etapa === emailItem.etapa));
            if (byEtapa) return byEtapa;
            if (checkEtapa && emailItem.etapa) {
                if (emailDateParts) {
                    const byDateAnyEtapa = findBestCandidate(c => basePredicate(c) && caseMatchesEmailDate(c, emailDateParts));
                    if (byDateAnyEtapa) return byDateAnyEtapa;
                }
                return findBestCandidate(basePredicate);
            }
            return null;
        };

        // 1. Verificar si algún caso ya tiene exactamente este radicado
        let matchedCase = allCases.find(c => String(c.radicado || '').trim() === emailItem.radicado);

        // 1.5. Si el correo trae el nombre exacto del aprendiz en el adjunto OnBase (C.I.(FRM)-...---NOMBRE-), cruzar prioritariamente por ese nombre
        if (!matchedCase && emailItem.aprendiz_nombre_adjunto) {
            const normAttName = normStr(emailItem.aprendiz_nombre_adjunto);
            if (normAttName.length >= 5) {
                matchedCase = findPrioritized(c => {
                    if (usedCaseIds.has(c.id)) return false;
                    if (c.radicado && String(c.radicado).trim() !== '' && !options.overwriteExisting) return false;
                    const cName = normStr(c.aprendiz_nombre);
                    if (!cName) return false;
                    const nameMatch = cName === normAttName || cName.includes(normAttName) || normAttName.includes(cName);
                    const fichaMatch = !emailItem.ficha || String(c.ficha || '').trim() === emailItem.ficha;
                    return nameMatch && fichaMatch;
                });
                if (!matchedCase) {
                    matchedCase = findPrioritized(c => {
                        if (usedCaseIds.has(c.id)) return false;
                        if (c.radicado && String(c.radicado).trim() !== '' && !options.overwriteExisting) return false;
                        const cName = normStr(c.aprendiz_nombre);
                        return cName && (cName === normAttName || cName.includes(normAttName) || normAttName.includes(cName));
                    });
                }
            }
        }

        // 2. Si no, buscar por número de documento explícito (si venía en adjunto o cuerpo)
        if (!matchedCase && emailItem.aprendiz_doc_numero) {
            matchedCase = findPrioritized(c =>
                !usedCaseIds.has(c.id) &&
                String(c.aprendiz_doc_numero || '').trim() === emailItem.aprendiz_doc_numero &&
                (!emailItem.ficha || String(c.ficha || '').trim() === emailItem.ficha)
            );
        }

        // 3. Cruce principal: Destinatario Para: (aprendiz_correo) + Ficha + Etapa
        if (!matchedCase && emailItem.toEmails.length > 0 && emailItem.ficha) {
            matchedCase = findPrioritized(c => {
                if (usedCaseIds.has(c.id)) return false;
                if (c.radicado && String(c.radicado).trim() !== '') return false;
                const cEmail = String(c.aprendiz_correo || '').trim().toLowerCase();
                if (!cEmail) return false;
                const emailMatches = emailItem.toEmails.some(em => cEmail.includes(em) || em.includes(cEmail));
                const fichaMatches = String(c.ficha || '').trim() === emailItem.ficha;
                return emailMatches && fichaMatches;
            });

            if (!matchedCase && options.overwriteExisting) {
                matchedCase = findPrioritized(c => {
                    if (usedCaseIds.has(c.id)) return false;
                    const cEmail = String(c.aprendiz_correo || '').trim().toLowerCase();
                    if (!cEmail) return false;
                    const emailMatches = emailItem.toEmails.some(em => cEmail.includes(em) || em.includes(cEmail));
                    const fichaMatches = String(c.ficha || '').trim() === emailItem.ficha;
                    return emailMatches && fichaMatches;
                });
            }
        }

        // 3.1 Cruce por Nombre del Aprendiz en la línea "Para:" + Ficha + Etapa (cuando Outlook muestra el nombre en lugar del correo)
        if (!matchedCase && emailItem.paraRawLine && emailItem.ficha) {
            const normPara = normStr(emailItem.paraRawLine);
            matchedCase = findPrioritized(c => {
                if (usedCaseIds.has(c.id)) return false;
                if (c.radicado && String(c.radicado).trim() !== '' && !options.overwriteExisting) return false;
                const cName = normStr(c.aprendiz_nombre);
                if (!cName || cName.length < 5) return false;
                const fichaMatches = String(c.ficha || '').trim() === emailItem.ficha;
                return fichaMatches && (normPara.includes(cName) || cName.includes(normPara));
            });
        }

        // 4. Cruce secundario: Destinatario Para: (aprendiz_correo) + Etapa (cuando el asunto no especifica ficha)
        if (!matchedCase && emailItem.toEmails.length > 0) {
            matchedCase = findPrioritized(c => {
                if (usedCaseIds.has(c.id)) return false;
                if (c.radicado && String(c.radicado).trim() !== '' && !options.overwriteExisting) return false;
                const cEmail = String(c.aprendiz_correo || '').trim().toLowerCase();
                if (!cEmail) return false;
                return emailItem.toEmails.some(em => cEmail === em || cEmail.includes(em));
            });
        }

        if (matchedCase) {
            usedCaseIds.add(matchedCase.id);
            const hadSame =
                String(matchedCase.radicado || '').trim() === emailItem.radicado &&
                String(matchedCase.nis || '').trim() === (emailItem.nis || String(matchedCase.nis || '').trim()) &&
                String(matchedCase.fecha_radicado || '').trim() === (emailItem.fecha_radicado || String(matchedCase.fecha_radicado || '').trim());

            const newNis = emailItem.nis || matchedCase.nis || null;
            const newFecha = emailItem.fecha_radicado || matchedCase.fecha_radicado || null;

            await pool.query(`
                UPDATE deserciones_casos
                SET radicado = $2,
                    nis = COALESCE($3, nis),
                    fecha_radicado = COALESCE($4, fecha_radicado),
                    status = 'Cargado',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [matchedCase.id, emailItem.radicado, newNis, newFecha]);

            matchedCase.radicado = emailItem.radicado;
            matchedCase.nis = newNis;
            matchedCase.fecha_radicado = newFecha;

            const recSummary = {
                id: matchedCase.id,
                etapa: matchedCase.etapa,
                ficha: matchedCase.ficha,
                aprendiz_doc_tipo: matchedCase.aprendiz_doc_tipo,
                aprendiz_doc_numero: matchedCase.aprendiz_doc_numero,
                aprendiz_nombre: matchedCase.aprendiz_nombre,
                aprendiz_correo: matchedCase.aprendiz_correo,
                radicado: emailItem.radicado,
                nis: newNis,
                fecha_radicado: newFecha,
                wasAlreadySet: hadSame
            };

            if (hadSame) {
                alreadyUpdated++;
            } else {
                updatedRecords.push(recSummary);
            }
        } else {
            unmatchedList.push(emailItem);
        }
    }

    return {
        totalCpeParsed: sortedEmails.length,
        matchedUpdatedCount: updatedRecords.length,
        alreadyUpdatedCount: alreadyUpdated,
        unmatchedCount: unmatchedList.length,
        updatedRecords,
        unmatchedList
    };
}

/**
 * Extrae datos del panel de lectura visible actualmente en Outlook Web (DOM)
 */
async function extractReadingPaneFromDom(page) {
    return await page.evaluate(() => {
        const result = {
            subject: '',
            radicado: '',
            nis: '',
            fecha_radicado: '',
            toEmails: [],
            paraLine: '',
            headerText: '',
            bodyText: '',
            bodyHtml: ''
        };

        const readingPane =
            document.querySelector('#ReadingPaneContainerId') ||
            document.querySelector('[role="region"][aria-label*="lectura" i]') ||
            document.querySelector('[role="region"][aria-label*="Reading" i]') ||
            document.querySelector('[data-app-section="ConversationContainer"]') ||
            document.querySelector('[data-app-section="ReadingPane"]') ||
            document.querySelector('[role="main"]');

        if (!readingPane) return result;

        // 1. Asunto (encabezado del correo)
        const subjEl =
            readingPane.querySelector('[role="heading"][aria-level="2"]') ||
            readingPane.querySelector('div[allowTextSelection="true"] span[title*="CPE"]') ||
            Array.from(readingPane.querySelectorAll('span, h1, h2, h3, div')).find(el =>
                /CPE\s*No\.\s*\d{2}-\d-\d{4}-\d+/i.test(el.textContent || '') &&
                (el.textContent || '').trim().length < 260
            );
        if (subjEl) {
            result.subject = (subjEl.textContent || '').replace(/\s+/g, ' ').trim();
        }

        const ariaAttachments = Array.from(readingPane.querySelectorAll('[aria-label*="C.I.(FRM)"], [title*="C.I.(FRM)"], [role="option"]'))
            .map(el => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.innerText || ''}`)
            .join('\n');
        const fullPaneText = `${readingPane.innerText || ''}\n${ariaAttachments}`;
        result.bodyText = fullPaneText;
        result.bodyHtml = readingPane.innerHTML || '';

        // 2. Destinatario "Para:" / "To:" en el encabezado del mensaje
        const paraLineMatch = fullPaneText.match(/(?:Para|To)\s*:\s*([^\r\n]+?)(?=\r|\n|\s*CC\s*:|\s*Retenci[oó]n|\s*Retention|$)/i);
        if (paraLineMatch && paraLineMatch[1]) {
            result.paraLine = paraLineMatch[1].trim();
            result.headerText = `Para: ${result.paraLine}`;
            const foundEmails = result.paraLine.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            result.toEmails.push(...foundEmails.map(e => e.toLowerCase()));
        }

        // También buscar chips/botones dentro de la fila "Para:" si el atributo/title tiene el correo
        const allSpansAndBtns = Array.from(readingPane.querySelectorAll('span[title*="@"], button[title*="@"], div[aria-label*="Para" i] span, div[aria-label*="To" i] span, [data-lov-id]'));
        for (const el of allSpansAndBtns) {
            const txt = `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`;
            const parentLine = el.closest('div')?.innerText || '';
            if (/^\s*CC\s*:/i.test(parentLine)) continue;
            const emails = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            for (const em of emails) {
                const lower = em.toLowerCase();
                if (!result.toEmails.includes(lower)) {
                    result.toEmails.push(lower);
                }
            }
        }

        // 3. Buscar tabla HTML "Radicado | N.I.S. | Fecha" (puede haber varias si la conversación agrupa varios correos)
        result.allItems = [];
        const tables = Array.from(readingPane.querySelectorAll('table'));
        for (const tbl of tables) {
            const rows = Array.from(tbl.querySelectorAll('tr')).map(tr =>
                Array.from(tr.querySelectorAll('th, td')).map(td => (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim())
            ).filter(r => r.length >= 3);

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                let rad = '', nisVal = '', fechaVal = '';
                if (/radicado/i.test(r[0]) && /n\.?i\.?s/i.test(r[1]) && i + 1 < rows.length) {
                    rad = rows[i + 1][0] || '';
                    nisVal = rows[i + 1][1] || '';
                    fechaVal = rows[i + 1][2] || '';
                } else if (/\b\d{2}-9-\d{4}-\d{4,8}\b/.test(r[0])) {
                    rad = r[0] || '';
                    nisVal = r[1] || '';
                    fechaVal = r[2] || '';
                }
                if (rad && /\b\d{2}-9-\d{4}-\d{4,8}\b/.test(rad)) {
                    const msgContainer = tbl.closest('[data-app-section="MessageCard"], [role="listitem"], div[tabindex="-1"]') || readingPane;
                    const msgText = msgContainer.innerText || fullPaneText;
                    const msgHtml = msgContainer.innerHTML || result.bodyHtml;
                    result.allItems.push({
                        radicado: rad,
                        nis: nisVal,
                        fecha_radicado: fechaVal,
                        bodyText: msgText,
                        bodyHtml: msgHtml
                    });
                    if (!result.radicado) {
                        result.radicado = rad;
                        result.nis = nisVal;
                        result.fecha_radicado = fechaVal;
                    }
                    break;
                }
            }
        }

        return result;
    });
}

/**
 * Asegura que el navegador dedicado de Outlook 365 esté abierto y vivo en el servidor (Keep-Alive).
 * Si ya estaba abierto en memoria, reutiliza la misma pestaña para que el correo permanezca abierto siempre.
 */
async function ensurePersistentOutlookBrowser() {
    if (emailSyncState.browser && emailSyncState.page) {
        try {
            if (!emailSyncState.page.isClosed()) {
                await emailSyncState.page.title(); // probar que responde
                ensureContinuousFrameCapture();
                return { browser: emailSyncState.browser, page: emailSyncState.page, reused: true };
            }
        } catch (_) {
            try { await emailSyncState.browser.close(); } catch (_) {}
            emailSyncState.browser = null;
            emailSyncState.page = null;
        }
    }

    const profileDir = path.join(__dirname, '..', 'uploads', 'outlook_profile_leparadam');
    if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
    }

    // Intentar reconectar primero al navegador permanente si ya está corriendo en el servidor (ej. tras reinicio de PM2)
    const activePortFile = path.join(profileDir, 'DevToolsActivePort');
    if (fs.existsSync(activePortFile)) {
        try {
            const lines = fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
            if (lines.length >= 2 && lines[0] && lines[1]) {
                const wsEndpoint = `ws://127.0.0.1:${lines[0].trim()}${lines[1].trim()}`;
                const existingBrowser = await puppeteer.connect({
                    browserWSEndpoint: wsEndpoint,
                    protocolTimeout: 20000,
                    defaultViewport: { width: 1366, height: 860 }
                });
                const existingPages = await existingBrowser.pages();
                const existingPage = existingPages.find(p => /outlook|microsoft/i.test(p.url() || '')) || existingPages[existingPages.length - 1];
                if (existingPage && !existingPage.isClosed()) {
                    await existingPage.title();
                    emailSyncState.browser = existingBrowser;
                    emailSyncState.page = existingPage;
                    ensureContinuousFrameCapture();
                    return { browser: existingBrowser, page: existingPage, reused: true };
                }
            }
        } catch (_) {}
    }

    try {
        require('child_process').execSync('pkill -9 -f outlook_profile_leparadam || true');
    } catch (_) {}
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(lockFile => {
        const p = path.join(profileDir, lockFile);
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    });

    const browser = await puppeteer.launch({
        headless: 'new',
        userDataDir: profileDir,
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

    // CRÍTICO:
    // 1. Evitar bloqueo por Windows Hello / PIN / Passkey (FIDO2) en Linux sin cabeza.
    // 2. Desbloquear automáticamente las animaciones KnockoutJS (.slide-in-next / paginationControlHelper.animationEnd)
    //    en login.microsoftonline.com para que ninguna pantalla quede congelada en opacidad 0.1.
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

    // Cerrar cualquier pestaña secundaria que se abra sola (ej. support.microsoft.com) para que no robe el foco
    browser.on('targetcreated', async (target) => {
        try {
            if (target.type() === 'page') {
                const newP = await target.page();
                if (newP && newP !== emailSyncState.page) {
                    await sleep(500);
                    const u = newP.url() || '';
                    if (!/outlook\.(office|office365)\.com|outlook\.cloud\.microsoft|login\.microsoftonline\.com/i.test(u)) {
                        await newP.close().catch(() => {});
                    }
                }
            }
        } catch (_) {}
    });

    // Interceptor pasivo de respuestas JSON de Outlook Web (GetItem / FindItem / FindConversation)
    page.on('response', async (response) => {
        try {
            const url = response.url();
            if (!/service\.svc|graph\.microsoft\.com|substrate\.office\.com|outlook\.cloud\.microsoft\/owa/i.test(url)) return;
            const ct = response.headers()['content-type'] || '';
            if (!ct.includes('json')) return;
            const txt = await response.text().catch(() => '');
            if (!txt || (!txt.includes('CPE No.') && !txt.includes('68-9-'))) return;

            const data = JSON.parse(txt);
            const walkJson = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj)) {
                    obj.forEach(walkJson);
                    return;
                }
                const subj = obj.Subject || obj.ConversationTopic || '';
                const bodyVal = obj.Body?.Value || obj.UniqueBody?.Value || obj.Preview || '';
                if ((subj && /CPE\s*No\./i.test(subj)) || (bodyVal && /68-9-20\d{2}-\d+/.test(bodyVal))) {
                    const toList = [];
                    if (Array.isArray(obj.ToRecipients)) {
                        obj.ToRecipients.forEach(r => {
                            if (r?.EmailAddress) toList.push(r.EmailAddress);
                            if (r?.Name && r.Name.includes('@')) toList.push(r.Name);
                        });
                    }
                    if (obj.DisplayTo && String(obj.DisplayTo).includes('@')) {
                        toList.push(String(obj.DisplayTo));
                    }
                    emailSyncState.interceptedItems.push({
                        subject: subj,
                        bodyHtml: bodyVal,
                        bodyText: bodyVal.replace(/<[^>]+>/g, ' '),
                        toEmails: toList
                    });
                }
                Object.values(obj).forEach(walkJson);
            };
            walkJson(data);
        } catch (_) {}
    });

    emailSyncState.browser = browser;
    emailSyncState.page = page;
    ensureContinuousFrameCapture();
    return { browser, page, reused: false };
}

/**
 * Ejecuta el Robot de Sincronización en Outlook 365 (leparadam@sena.edu.co -> Carpeta Producidas)
 */
const executeEmailSyncBot = async (req, res) => {
    const {
        email_user = 'leparadam@sena.edu.co',
        email_password = '',
        folder_name = 'Producidas',
        max_emails = 250,
        overwrite_existing = false,
        force_restart = false
    } = req.body || {};

    if (emailSyncState.isRunning) {
        if (force_restart || emailSyncState.status === 'waiting_auth' || emailSyncState.status === 'error') {
            emailSyncState.isRunning = false;
            await sleep(400);
        } else {
            return res.status(409).json({
                error: 'Ya hay una sincronización de correo en curso.',
                jobId: emailSyncState.jobId
            });
        }
    }

    // Guardar preferencia de usuario y carpeta en system_settings
    try {
        await pool.query(
            `INSERT INTO system_settings (key, value) VALUES ('deserciones_email_user', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [email_user]
        );
        await pool.query(
            `INSERT INTO system_settings (key, value) VALUES ('deserciones_email_folder', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [folder_name]
        );
        if (email_password && String(email_password).trim()) {
            await pool.query(
                `INSERT INTO system_settings (key, value) VALUES ('deserciones_email_pass', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [String(email_password).trim()]
            );
        }
    } catch (_) {}

    // Si no enviaron contraseña en el body, leer la guardada en system_settings
    let effectivePass = String(email_password || '').trim();
    if (!effectivePass) {
        try {
            const pRes = await pool.query("SELECT value FROM system_settings WHERE key = 'deserciones_email_pass' LIMIT 1");
            if (pRes.rows?.[0]?.value) effectivePass = String(pRes.rows[0].value).trim();
        } catch (_) {}
    }

    const jobId = `email-sync-${Date.now()}`;
    emailSyncState.isRunning = true;
    emailSyncState.jobId = jobId;
    emailSyncState.status = 'running';
    emailSyncState.mfaNumber = null;
    emailSyncState.authPrompt = null;
    emailSyncState.logs = [];
    emailSyncState.interceptedItems = [];
    emailSyncState.stats = {
        emailsScanned: 0,
        cpeFound: 0,
        matchedUpdated: 0,
        alreadyUpdated: 0,
        unmatchedCount: 0,
        unmatchedList: []
    };
    emailSyncState.updatedRecords = [];
    emailSyncState._triedAutoPass = false;
    emailSyncState._clickedUsePassword = false;
    emailSyncState._clickedAuthenticatorPushCount = 0;
    emailSyncState._loggedPassWait = false;
    emailSyncState._loggedOtpWait = false;
    emailSyncState._lastMfaLogged = null;
    emailSyncState._troubleReloadCount = 0;

    res.json({
        success: true,
        jobId,
        message: `Conectando con el buzón permanente ${email_user} (Carpeta: ${folder_name})...`
    });

    // Proceso asíncrono en segundo plano manteniendo el navegador ABIERTO en el servidor
    (async () => {
        try {
            const { page, reused } = await ensurePersistentOutlookBrowser();
            if (reused) {
                addSyncLog(`🟢 Reutilizando sesión abierta en el servidor para ${email_user}...`);
            } else {
                addSyncLog(`🚀 Iniciando sesión permanente de Outlook 365 en el servidor (${email_user})...`);
            }

            const currUrl = page.url() || '';
            const isAlreadyInsideMail = /outlook\.(office|office365)\.com\/mail|outlook\.cloud\.microsoft\/mail/i.test(currUrl);
            if (!isAlreadyInsideMail) {
                addSyncLog(`🌐 Abriendo Outlook 365 (https://outlook.office.com/mail/)...`);
                await page.goto('https://outlook.office.com/mail/', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                await sleep(2200);
                await flushMicrosoftLoginAnimations(page);
            }
            await captureFrame();

            // ── PASO 1: Verificar inicio de sesión en Microsoft 365 (Saltando PIN/Passkey y desbloqueando animaciones) ──
            let mailboxReady = false;
            const authStart = Date.now();
            const maxAuthWaitMs = 300000; // Hasta 5 minutos para aprobar en celular la primera vez

            while (Date.now() - authStart < maxAuthWaitMs) {
                if (!emailSyncState.isRunning) throw new Error('Sincronización detenida por el usuario.');

                await flushMicrosoftLoginAnimations(page);

                const pageState = await page.evaluate((targetEmail) => {
                    const url = window.location.href;
                    const bodyTxt = document.body?.innerText || '';
                    const lowerEmail = String(targetEmail || 'leparadam@sena.edu.co').toLowerCase().trim();

                    // 1. ¿Ya estamos dentro de Outlook Mail (outlook.office.com o outlook.cloud.microsoft)?
                    const hasMailUi = Boolean(
                        document.querySelector('[role="tree"]') ||
                        document.querySelector('#MainModule') ||
                        document.querySelector('#topSearchInput') ||
                        document.querySelector('[data-app-section="NavigationPane"]') ||
                        document.querySelector('[data-app-section="MessageList"]') ||
                        document.querySelector('[aria-label*="Panel de carpetas" i]') ||
                        document.querySelector('[aria-label*="Folder pane" i]') ||
                        document.querySelector('[aria-label*="Navigation pane" i]') ||
                        document.querySelector('button[aria-label*="Correo nuevo" i]') ||
                        document.querySelector('button[aria-label*="New mail" i]')
                    );
                    if (hasMailUi) return { type: 'MAIL_READY', url };

                    // 1.5 ¿Error de sesión expirada / "Sorry, we're having trouble verifying your account"?
                    if (/having trouble verifying your account|problemas para verificar su cuenta|try signing in again/i.test(bodyTxt)) {
                        return { type: 'MFA_TROUBLE_ERROR', url };
                    }

                    // 2. ¿Expiró la solicitud de Authenticator ("Send another request" / "Volver a enviar")?
                    const resendLink = document.querySelector('#idA_SAOTCAS_Resend');
                    if (resendLink && resendLink.offsetParent !== null) {
                        return { type: 'MFA_RESEND', url };
                    }

                    // 2.1 ¿Pantalla de número Microsoft Authenticator (2 dígitos)?
                    const mfaDisplay = document.querySelector('#idRichContext_DisplaySign, #displaySign, .displaySign, [data-bind*="displaySign"]');
                    if (mfaDisplay && mfaDisplay.offsetParent !== null && mfaDisplay.innerText.trim()) {
                        return { type: 'MFA_NUMBER', number: mfaDisplay.innerText.trim(), url };
                    }

                    // 3. ¿Pantalla de código OTP (6 dígitos)?
                    const otpInput = document.querySelector('input[name="otc"], #idTxtBx_SAOTCC_OTC, input[type="tel"]');
                    if (otpInput && otpInput.offsetParent !== null) {
                        return { type: 'MFA_OTP', url };
                    }

                    // 4. ¿Pantalla "Suspicious activity detected" / "Verify" (#idSIButton9 con valor Verify/Verificar)?
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

                    // 5. ¿Pantalla "Choose a way to sign in" (donde aparece "Face, fingerprint, PIN" y "Use my password")?
                    const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                    const usePwdOption = clickables.find(el =>
                        el.offsetParent !== null &&
                        /use my password|usar mi contrase|usar contrase|iniciar sesi[oó]n con contrase/i.test(el.innerText || '')
                    );
                    if (usePwdOption) {
                        return { type: 'CHOOSE_USE_PASSWORD', url };
                    }

                    // 6. ¿Pantalla de contraseña?
                    const passInput = document.querySelector('input[type="password"], input[name="passwd"], #i0118');
                    if (passInput && passInput.offsetParent !== null) {
                        const errEl = document.querySelector('#passwordError, .error');
                        return { type: 'NEED_PASSWORD', url, error: errEl ? errEl.innerText.trim() : '' };
                    }

                    // 7. ¿Pantalla "Verify your identity" (lista de métodos MFA: Authenticator / SMS / Código)?
                    const authPushOption = clickables.find(el =>
                        el.offsetParent !== null &&
                        /approve a request on my microsoft authenticator|aprobar una solicitud en mi aplicaci[oó]n microsoft authenticator/i.test(el.innerText || '')
                    );
                    if (authPushOption && /verify your identity|verificar su identidad|comprobar su identidad/i.test(bodyTxt)) {
                        return { type: 'CHOOSE_MFA_METHOD', url };
                    }

                    // 8. ¿Pantalla de usuario Microsoft?
                    const emailInput = document.querySelector('input[type="email"], input[name="loginfmt"], #i0116');
                    if (emailInput && emailInput.offsetParent !== null) {
                        return { type: 'NEED_EMAIL', url };
                    }

                    // 9. ¿Pantalla "¿Quiere mantener la sesión iniciada?" (KMSI)?
                    const kmsiBtn = document.querySelector('#idSIButton9, button[type="submit"]');
                    if (kmsiBtn && kmsiBtn.offsetParent !== null && /mantener la sesi[oó]n|stay signed in/i.test(bodyTxt)) {
                        return { type: 'KMSI_PROMPT', url };
                    }

                    // 10. ¿Selección de cuenta ("Elegir una cuenta" / "Pick an account")?
                    const otherTile = document.querySelector('#otherTile');
                    const accountTile =
                        document.querySelector(`[data-test-id="${lowerEmail}"]`) ||
                        document.querySelector('#tilesHolder [data-test-id*="sena.edu.co"]') ||
                        Array.from(document.querySelectorAll('#tilesHolder .table, #tilesHolder [role="listitem"], #tilesHolder [role="button"]')).find(
                            el => el.offsetParent !== null && el.id !== 'otherTile' && (el.innerText || '').toLowerCase().includes('sena.edu.co')
                        );
                    const hasAccountTile = Boolean(accountTile && accountTile.offsetParent !== null);
                    const hasOtherTile = Boolean(otherTile && otherTile.offsetParent !== null);
                    if (hasAccountTile || hasOtherTile) {
                        return { type: 'PICK_ACCOUNT', hasAccountTile, hasOtherTile, url };
                    }

                    // 11. ¿Puente FIDO/PIN temporal?
                    if (url.includes('/bridge/fido') || /face, fingerprint, pin or security key|rostro, huella digital, pin/i.test(bodyTxt)) {
                        return { type: 'FIDO_BRIDGE', url };
                    }

                    return { type: 'LOADING', url, snippet: bodyTxt.slice(0, 160).replace(/\s+/g, ' ') };
                }, email_user).catch(() => ({ type: 'LOADING', url: '' }));

                if (pageState.type === 'MAIL_READY') {
                    mailboxReady = true;
                    emailSyncState.status = 'running';
                    emailSyncState.mfaNumber = null;
                    emailSyncState.authPrompt = null;
                    addSyncLog(`✅ Buzón Outlook 365 abierto y activo en el servidor (${email_user}).`);
                    break;
                }

                if (pageState.type === 'MFA_TROUBLE_ERROR') {
                    if (emailSyncState._troubleReloadCount < 3) {
                        emailSyncState._troubleReloadCount++;
                        emailSyncState._clickedAuthenticatorPushCount = 0;
                        emailSyncState._triedAutoPass = false;
                        addSyncLog(`🔄 Sesión previa expirada en Microsoft; reabriendo solicitud limpia de Outlook 365...`);
                        await page.goto('https://outlook.office.com/mail/', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                        await sleep(2200);
                        await flushMicrosoftLoginAnimations(page);
                        await captureFrame();
                        continue;
                    }
                }

                if (pageState.type === 'SUSPICIOUS_ACTIVITY_VERIFY') {
                    addSyncLog(`🛡️ Confirmando verificación de seguridad de Microsoft ("Verify") para pasar a Microsoft Authenticator...`);
                    await page.evaluate(() => {
                        const btn = document.querySelector('#idSIButton9, input[type="submit"], button[type="submit"]');
                        if (btn) btn.click();
                    }).catch(() => {});
                    await sleep(1800);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'FIDO_BRIDGE') {
                    addSyncLog(`⚡ Omitiendo solicitud de PIN / Windows Hello para pasar directo a Contraseña / Authenticator...`);
                    await sleep(1500);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'CHOOSE_USE_PASSWORD') {
                    addSyncLog(`🔑 Seleccionando automáticamente "Usar mi contraseña" (omitiendo PIN de equipo)...`);
                    await page.evaluate(() => {
                        const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                        const usePwd = clickables.find(el =>
                            el.offsetParent !== null &&
                            /use my password|usar mi contrase|usar contrase|iniciar sesi[oó]n con contrase/i.test(el.innerText || '')
                        );
                        if (usePwd) usePwd.click();
                    });
                    await sleep(1800);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'PICK_ACCOUNT') {
                    if (pageState.hasAccountTile) {
                        addSyncLog(`👤 Seleccionando cuenta institucional guardada ${email_user}...`);
                        await page.evaluate((targetEmail) => {
                            const lowerEmail = String(targetEmail || 'leparadam@sena.edu.co').toLowerCase().trim();
                            const tile =
                                document.querySelector(`[data-test-id="${lowerEmail}"] .table`) ||
                                document.querySelector(`[data-test-id="${lowerEmail}"]`) ||
                                document.querySelector('#tilesHolder [data-test-id*="sena.edu.co"] .table') ||
                                document.querySelector('#tilesHolder [data-test-id*="sena.edu.co"]') ||
                                Array.from(document.querySelectorAll('#tilesHolder .table, #tilesHolder [role="listitem"], #tilesHolder [role="button"]')).find(
                                    el => el.offsetParent !== null && el.id !== 'otherTile' && (el.innerText || '').toLowerCase().includes('sena.edu.co')
                                );
                            if (tile) tile.click();
                        }, email_user).catch(() => {});
                    } else if (pageState.hasOtherTile) {
                        addSyncLog(`👤 Seleccionando "Usar otra cuenta" para ingresar ${email_user}...`);
                        await page.click('#otherTile').catch(() => {});
                    }
                    await sleep(2000);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'NEED_EMAIL') {
                    addSyncLog(`📧 Ingresando correo institucional: ${email_user}...`);
                    await page.click('input[type="email"], input[name="loginfmt"], #i0116', { clickCount: 3 }).catch(() => {});
                    await page.keyboard.press('Backspace').catch(() => {});
                    await page.type('input[type="email"], input[name="loginfmt"], #i0116', email_user, { delay: 25 }).catch(() => {});
                    await sleep(400);
                    await page.click('#idSIButton9, input[type="submit"], button[type="submit"]').catch(() => {
                        return page.keyboard.press('Enter');
                    });
                    await sleep(4000);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'NEED_PASSWORD') {
                    if (effectivePass && !emailSyncState._triedAutoPass) {
                        emailSyncState._triedAutoPass = true;
                        addSyncLog(`🔑 Ingresando contraseña guardada de ${email_user}...`);
                        await page.click('input[type="password"], input[name="passwd"], #i0118', { clickCount: 3 }).catch(() => {});
                        await page.keyboard.press('Backspace').catch(() => {});
                        await page.type('input[type="password"], input[name="passwd"], #i0118', effectivePass, { delay: 25 }).catch(() => {});
                        await sleep(400);
                        await page.click('#idSIButton9, input[type="submit"], button[type="submit"]').catch(() => {
                            return page.keyboard.press('Enter');
                        });
                        await sleep(2800);
                        await flushMicrosoftLoginAnimations(page);
                        await captureFrame();
                        continue;
                    } else {
                        emailSyncState.status = 'waiting_auth';
                        emailSyncState.authPrompt = pageState.error
                            ? `Microsoft reportó: "${pageState.error}". Escriba la contraseña actual de ${email_user} abajo y presione Enviar.`
                            : `Escriba la contraseña de ${email_user} en el recuadro inferior y presione Enviar.`;
                        if (!emailSyncState._loggedPassWait) {
                            emailSyncState._loggedPassWait = true;
                            addSyncLog(`⏳ Esperando contraseña de ${email_user}...`);
                        }
                        await captureFrame();
                        await sleep(1800);
                        continue;
                    }
                }

                if (pageState.type === 'CHOOSE_MFA_METHOD') {
                    if ((emailSyncState._clickedAuthenticatorPushCount || 0) < 3) {
                        emailSyncState._clickedAuthenticatorPushCount = (emailSyncState._clickedAuthenticatorPushCount || 0) + 1;
                        addSyncLog(`📲 Activando automáticamente solicitud de número en Microsoft Authenticator para mostrar el código de inmediato...`);
                        await page.evaluate(() => {
                            const clickables = Array.from(document.querySelectorAll('div[role="button"], button, a, div.table'));
                            const authPush = clickables.find(el =>
                                el.offsetParent !== null &&
                                /approve a request on my microsoft authenticator|aprobar una solicitud en mi aplicaci[oó]n microsoft authenticator/i.test(el.innerText || '')
                            );
                            if (authPush) authPush.click();
                        });
                        await sleep(2000);
                        await flushMicrosoftLoginAnimations(page);
                        await captureFrame();
                        continue;
                    }
                }

                if (pageState.type === 'MFA_RESEND') {
                    addSyncLog(`🔄 Renovando solicitud de número en Microsoft Authenticator...`);
                    await page.click('#idA_SAOTCAS_Resend').catch(() => {});
                    await sleep(2200);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                if (pageState.type === 'MFA_NUMBER') {
                    emailSyncState.status = 'waiting_auth';
                    emailSyncState.mfaNumber = pageState.number;
                    emailSyncState.authPrompt = `Marque el número ${pageState.number} en la app Microsoft Authenticator de su celular. Una vez aprobado, su correo quedará abierto permanentemente en el servidor.`;
                    // Marcar casilla "No volver a preguntar" si existe
                    await page.evaluate(() => {
                        const chk = document.querySelector('#idChkBx_SAOTCAS_TD, input[type="checkbox"]');
                        if (chk && !chk.checked) chk.click();
                    }).catch(() => {});
                    if (emailSyncState._lastMfaLogged !== pageState.number) {
                        emailSyncState._lastMfaLogged = pageState.number;
                        addSyncLog(`📲 [CÓDIGO EN PANTALLA: #${pageState.number}] Marque el número ${pageState.number} en su celular (Microsoft Authenticator) para dejar su correo abierto en el servidor.`);
                    }
                    await captureFrame();
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'MFA_OTP') {
                    emailSyncState.status = 'waiting_auth';
                    emailSyncState.authPrompt = `Escriba el código de verificación de 6 dígitos en la barra inferior y presione Enviar.`;
                    if (!emailSyncState._loggedOtpWait) {
                        emailSyncState._loggedOtpWait = true;
                        addSyncLog(`📲 Esperando código de verificación de 6 dígitos...`);
                    }
                    await captureFrame();
                    await sleep(1800);
                    continue;
                }

                if (pageState.type === 'KMSI_PROMPT') {
                    addSyncLog(`💾 Marcando "No volver a mostrar" y "Sí" para dejar el correo abierto permanentemente en el servidor...`);
                    await page.evaluate(() => {
                        const chk = document.querySelector('#KmsiCheckboxField, input[type="checkbox"]');
                        if (chk && !chk.checked) chk.click();
                        const yesBtn = document.querySelector('#idSIButton9, button[type="submit"], input[type="submit"]');
                        if (yesBtn) yesBtn.click();
                    }).catch(() => {});
                    await sleep(3200);
                    await flushMicrosoftLoginAnimations(page);
                    await captureFrame();
                    continue;
                }

                await sleep(1500);
            }

            if (!mailboxReady) {
                throw new Error('Tiempo de espera agotado esperando la aprobación de inicio de sesión en Outlook 365. El navegador sigue abierto para que pueda completarlo.');
            }

            await sleep(2500);
            await captureFrame();

            // ── PASO 2: Localizar y abrir la carpeta "Producidas" ──
            addSyncLog(`📂 Abriendo la carpeta "${folder_name}" en el buzón ${email_user}...`);

            const openTargetFolder = async () => {
                for (let pass = 0; pass < 5; pass++) {
                    // 1. Cerrar posibles modales de bienvenida / avisos de Outlook que tapen el panel izquierdo
                    await page.evaluate(() => {
                        const dismissBtns = Array.from(document.querySelectorAll(
                            'button[aria-label*="Cerrar" i], button[aria-label*="Close" i], button[aria-label*="Descartar" i], button[aria-label*="Dismiss" i]'
                        ));
                        dismissBtns.forEach(btn => {
                            if (btn.closest('[role="dialog"], .ms-Modal, .fui-DialogSurface')) {
                                try { btn.click(); } catch (_) {}
                            }
                        });
                    }).catch(() => {});

                    // 2. Si el panel izquierdo de carpetas está oculto (ningún treeitem visible), pulsar el botón de mostrar panel de navegación
                    const treeCount = await page.evaluate(() => document.querySelectorAll('[role="treeitem"]').length).catch(() => 0);
                    if (treeCount === 0) {
                        await page.evaluate(() => {
                            const navToggle = document.querySelector(
                                'button[aria-label*="Panel de navegación" i], button[aria-label*="Navigation pane" i], button[aria-label*="Mostrar panel" i], button[aria-label*="Toggle Left Pane" i]'
                            );
                            if (navToggle) navToggle.click();
                        }).catch(() => {});
                        await sleep(1200);
                    }

                    // 3. Buscar la carpeta objetivo ("Producidas") y obtener sus coordenadas o hacer click directo
                    const foundInfo = await page.evaluate((targetFolder) => {
                        const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                        const targetNorm = norm(targetFolder);

                        const candidates = Array.from(document.querySelectorAll('[role="treeitem"], [data-folder-name], div[title], span'));
                        for (const el of candidates) {
                            if (el.offsetParent === null) continue;
                            const titleAttr = norm(el.getAttribute('title') || '');
                            const folderAttr = norm(el.getAttribute('data-folder-name') || '');
                            const ariaAttr = norm(el.getAttribute('aria-label') || '');
                            const ownText = norm(el.childNodes.length === 1 ? el.textContent : '');

                            if (
                                titleAttr === targetNorm ||
                                folderAttr === targetNorm ||
                                ownText === targetNorm ||
                                ariaAttr.startsWith(targetNorm + ' ') ||
                                ariaAttr.includes(' ' + targetNorm + ' ') ||
                                ariaAttr === targetNorm
                            ) {
                                const clickable = el.closest('[role="treeitem"]') || el;
                                clickable.scrollIntoView({ block: 'center' });
                                const rect = clickable.getBoundingClientRect();
                                clickable.click();
                                return {
                                    status: 'FOUND',
                                    x: Math.round(rect.left + rect.width / 2),
                                    y: Math.round(rect.top + rect.height / 2)
                                };
                            }
                        }

                        // Expandir nodos contraídos del árbol de carpetas (Folders / Carpetas / Bandeja de entrada / Subcarpetas)
                        const collapsedNodes = Array.from(document.querySelectorAll('[role="treeitem"][aria-expanded="false"]'));
                        collapsedNodes.forEach(node => {
                            const chevron = node.querySelector('button, i, svg, [data-icon-name*="Chevron"]') || node;
                            try { chevron.click(); } catch (_) {}
                        });

                        // También hacer scroll en el árbol de carpetas por si está más abajo
                        const treeEl = document.querySelector('[role="tree"]')?.parentElement || document.querySelector('[data-app-section="NavigationPane"]');
                        if (treeEl) {
                            treeEl.scrollTop += 250;
                        }
                        return { status: 'EXPANDED' };
                    }, folder_name).catch(() => ({ status: 'ERROR' }));

                    if (foundInfo && foundInfo.status === 'FOUND') {
                        if (foundInfo.x > 0 && foundInfo.y > 0) {
                            await page.mouse.click(foundInfo.x, foundInfo.y).catch(() => {});
                        }
                        return true;
                    }
                    await sleep(1400);
                }
                return false;
            };

            const folderOpened = await openTargetFolder();
            if (folderOpened) {
                addSyncLog(`✅ Carpeta "${folder_name}" localizada y abierta.`);
            } else {
                addSyncLog(`🔎 Carpeta "${folder_name}" no visible en el árbol; buscando notificaciones "CPE No." en el buscador de Outlook...`);
                const searchBox = await page.$('input[aria-label*="Buscar" i], input[aria-label*="Search" i], #topSearchInput');
                if (searchBox) {
                    await searchBox.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await searchBox.type(`"CPE No."`, { delay: 30 });
                    await page.keyboard.press('Enter');
                }
            }

            await sleep(3500);
            await captureFrame();

            // ── PASO 3: Recorrer la lista de correos de la carpeta "Producidas" y extraer Radicado, N.I.S. y Fecha ──
            addSyncLog(`📨 Escaneando notificaciones de OnBase ("CPE No.") en "${folder_name}"...`);

            // Volver al inicio de la lista de mensajes antes de escanear
            await page.evaluate(() => {
                const scroller = document.querySelector('.customScrollBar.jEpCF') ||
                    document.querySelector('[role="listbox"].customScrollBar') ||
                    Array.from(document.querySelectorAll('#MailList, [role="listbox"], [data-app-section="MessageList"], #MailList *, [role="listbox"] *, [data-app-section="MessageList"] *'))
                        .find(el => !el.closest('#ReadingPaneContainerId, [data-app-section="ReadingPane"]') && el.scrollHeight > el.clientHeight + 20 && /auto|scroll/i.test(window.getComputedStyle(el).overflowY));
                if (scroller) scroller.scrollTop = 0;
            }).catch(() => {});
            await sleep(800);

            const visitedRowKeys = new Set();
            const extractedRawEmails = [];
            let emptyScrollPasses = 0;
            const effectiveMaxEmails = Math.max(Number(max_emails) || 250, 250);

            while (extractedRawEmails.length < effectiveMaxEmails && emptyScrollPasses < 8) {
                if (!emailSyncState.isRunning) break;

                const visibleRows = await page.evaluate(() => {
                    const scroller = document.querySelector('.customScrollBar.jEpCF') || document;
                    const optionEls = Array.from(
                        scroller.querySelectorAll('[role="option"], [data-convid]')
                    ).filter(el => !el.closest('#ReadingPaneContainerId, [data-app-section="ReadingPane"], [data-app-section="ConversationContainer"]'));
                    return optionEls.map((el, idx) => {
                        const rowId = el.id || '';
                        const convId = el.getAttribute('data-convid') || '';
                        const aria = (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
                        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
                        const radMatch = (`${aria} ${text}`.match(/\b(\d{2}-9-\d{4}-\d{4,8})\b/) || [''])[0];
                        const key = radMatch || rowId || convId || aria.slice(0, 160) || text.slice(0, 160) || `idx-${idx}`;
                        return { idx, key, aria, text };
                    }).filter(r => r.text.length > 10 || r.aria.length > 10);
                });

                let clickedNewInThisPass = 0;

                for (const rowInfo of visibleRows) {
                    if (!emailSyncState.isRunning) break;
                    if (visitedRowKeys.has(rowInfo.key)) continue;

                    const summaryStr = `${rowInfo.aria} ${rowInfo.text}`;
                    if (!/CPE\s*No\.|68-9-20\d{2}-|grupoadmondocumentos|CITACI[OÓ]N\s+A\s+COMIT[EÉ]|DESERCI[OÓ]N|RESOLUCI[OÓ]N|DEPURACI[OÓ]N|POR\s+CERTIFICAR|ACCIONES\s+DE\s+FORMACI[OÓ]N|NOTIFICACI[OÓ]N/i.test(summaryStr)) {
                        visitedRowKeys.add(rowInfo.key);
                        continue;
                    }

                    visitedRowKeys.add(rowInfo.key);
                    clickedNewInThisPass++;
                    emailSyncState.stats.emailsScanned++;

                    const clickCoords = await page.evaluate((targetKey) => {
                        const scroller = document.querySelector('.customScrollBar.jEpCF') || document;
                        const optionEls = Array.from(
                            scroller.querySelectorAll('[role="option"], [data-convid]')
                        ).filter(el => !el.closest('#ReadingPaneContainerId, [data-app-section="ReadingPane"], [data-app-section="ConversationContainer"]'));
                        for (const el of optionEls) {
                            const rowId = el.id || '';
                            const convId = el.getAttribute('data-convid') || '';
                            const aria = (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
                            const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
                            const radMatch = (`${aria} ${text}`.match(/\b(\d{2}-9-\d{4}-\d{4,8})\b/) || [''])[0];
                            const key = radMatch || rowId || convId || aria.slice(0, 160) || text.slice(0, 160);
                            if (key === targetKey) {
                                el.scrollIntoView({ block: 'nearest' });
                                const rect = el.getBoundingClientRect();
                                el.click();
                                return {
                                    ok: true,
                                    x: Math.round(rect.left + Math.min(120, rect.width / 2)),
                                    y: Math.round(rect.top + rect.height / 2)
                                };
                            }
                        }
                        return { ok: false };
                    }, rowInfo.key);

                    if (!clickCoords || !clickCoords.ok) continue;
                    if (clickCoords.x > 0 && clickCoords.y > 0) {
                        await page.mouse.click(clickCoords.x, clickCoords.y).catch(() => {});
                    }

                    const expectedRadMatch = summaryStr.match(/\b(\d{2}-9-\d{4}-\d{4,8})\b/);
                    const expectedRad = expectedRadMatch ? expectedRadMatch[1] : null;

                    let paneData = null;
                    for (let attempt = 0; attempt < 6; attempt++) {
                        await sleep(400);
                        paneData = await extractReadingPaneFromDom(page);
                        if (paneData && paneData.radicado && (!expectedRad || paneData.radicado === expectedRad)) {
                            break;
                        }
                    }

                    if (!paneData || (!paneData.radicado && !expectedRad)) {
                        continue;
                    }

                    const itemsFromPane = (Array.isArray(paneData.allItems) && paneData.allItems.length > 0)
                        ? paneData.allItems
                        : [{
                            radicado: paneData.radicado || expectedRad || '',
                            nis: paneData.nis || '',
                            fecha_radicado: paneData.fecha_radicado || '',
                            bodyText: paneData.bodyText || summaryStr,
                            bodyHtml: paneData.bodyHtml || ''
                        }];

                    for (const item of itemsFromPane) {
                        const rawEmailObj = {
                            subject: paneData.subject || summaryStr,
                            radicado: item.radicado || paneData.radicado || expectedRad || '',
                            nis: item.nis || paneData.nis || '',
                            fecha_radicado: item.fecha_radicado || paneData.fecha_radicado || '',
                            toEmails: paneData.toEmails || [],
                            paraLine: paneData.paraLine || '',
                            headerText: paneData.headerText || '',
                            bodyText: item.bodyText || paneData.bodyText || summaryStr,
                            bodyHtml: item.bodyHtml || paneData.bodyHtml || ''
                        };

                        extractedRawEmails.push(rawEmailObj);
                        emailSyncState.stats.cpeFound = extractedRawEmails.length;

                        const partialSync = await syncExtractedEmailsWithDatabase([rawEmailObj], { overwriteExisting: overwrite_existing });
                        if (partialSync.updatedRecords.length > 0) {
                            const upd = partialSync.updatedRecords[0];
                            emailSyncState.updatedRecords.push(upd);
                            emailSyncState.stats.matchedUpdated = emailSyncState.updatedRecords.length;
                            addSyncLog(`✅ [${upd.aprendiz_doc_numero}] ${upd.aprendiz_nombre} (Ficha ${upd.ficha}) → Radicado: ${upd.radicado} | NIS: ${upd.nis || 'N/A'} | Fecha: ${upd.fecha_radicado || 'N/A'}`);
                        } else if (partialSync.alreadyUpdatedCount > 0) {
                            emailSyncState.stats.alreadyUpdated++;
                            addSyncLog(`ℹ️ Radicado ${rawEmailObj.radicado} ya estaba registrado en la base de datos.`);
                        } else {
                            const parsedPreview = parseRawCpeEmail(rawEmailObj);
                            addSyncLog(`⚠️ Correo CPE ${parsedPreview.radicado} (Para: ${parsedPreview.toEmails.join(', ') || parsedPreview.paraRawLine || 'N/D'} | Ficha: ${parsedPreview.ficha || 'N/D'}) leído.`);
                        }
                    }

                    if (extractedRawEmails.length >= effectiveMaxEmails) break;
                }

                if (emailSyncState.interceptedItems.length > 0) {
                    const batchNet = emailSyncState.interceptedItems.splice(0, emailSyncState.interceptedItems.length);
                    extractedRawEmails.push(...batchNet);
                }

                if (clickedNewInThisPass === 0) {
                    emptyScrollPasses++;
                } else {
                    emptyScrollPasses = 0;
                }

                // Desplazar el contenedor real con scroll dentro de #MailList / [role="listbox"] (.customScrollBar.jEpCF)
                const scrolled = await page.evaluate(() => {
                    const scroller = document.querySelector('.customScrollBar.jEpCF') ||
                        document.querySelector('[role="listbox"].customScrollBar') ||
                        Array.from(document.querySelectorAll('#MailList, [role="listbox"], [data-app-section="MessageList"], #MailList *, [role="listbox"] *, [data-app-section="MessageList"] *'))
                            .find(el => !el.closest('#ReadingPaneContainerId, [data-app-section="ReadingPane"]') && el.scrollHeight > el.clientHeight + 20 && /auto|scroll/i.test(window.getComputedStyle(el).overflowY));
                    if (scroller) {
                        const prev = scroller.scrollTop;
                        scroller.scrollTop += 480;
                        return scroller.scrollTop > prev;
                    }
                    const options = Array.from(document.querySelectorAll('[role="listbox"] [role="option"]'))
                        .filter(el => !el.closest('#ReadingPaneContainerId, [data-app-section="ReadingPane"]'));
                    if (options.length > 0) {
                        options[options.length - 1].scrollIntoView({ block: 'end' });
                        return true;
                    }
                    return false;
                });

                if (!scrolled && clickedNewInThisPass === 0) {
                    break;
                }
                await sleep(1000);
            }

            const finalSync = await syncExtractedEmailsWithDatabase(extractedRawEmails, { overwriteExisting: overwrite_existing });
            emailSyncState.stats.cpeFound = finalSync.totalCpeParsed;
            emailSyncState.stats.unmatchedCount = finalSync.unmatchedCount;
            emailSyncState.stats.unmatchedList = finalSync.unmatchedList.slice(0, 30);

            addSyncLog(`🎯 Sincronización finalizada: ${emailSyncState.stats.cpeFound} notificaciones CPE leídas en "${folder_name}", ${emailSyncState.stats.matchedUpdated} aprendices actualizados con nuevo Radicado/Fecha (${emailSyncState.stats.alreadyUpdated} ya estaban al día). El buzón queda abierto en el servidor.`);
            emailSyncState.status = 'completed';
            await captureFrame();
        } catch (err) {
            console.error('[DESERCIONES-EMAIL-SYNC] Error:', err);
            addSyncLog(`❌ Error en sincronización de correo: ${err.message}`);
            emailSyncState.status = 'error';
            await captureFrame();
        } finally {
            // IMPORTANTE: NO cerramos emailSyncState.browser para que el correo quede ABIERTO permanentemente en el servidor
            emailSyncState.isRunning = false;
        }
    })();
};

const getEmailSyncStatus = async (req, res) => {
    const hasBrowserOpen = Boolean(emailSyncState.browser && emailSyncState.page && !emailSyncState.page.isClosed());
    let hasSavedPassword = false;
    let savedEmailUser = 'leparadam@sena.edu.co';
    let savedEmailFolder = 'Producidas';
    try {
        const sRes = await pool.query(
            "SELECT key, value FROM system_settings WHERE key IN ('deserciones_email_user', 'deserciones_email_pass', 'deserciones_email_folder')"
        );
        for (const r of (sRes.rows || [])) {
            if (r.key === 'deserciones_email_user' && r.value) savedEmailUser = r.value;
            if (r.key === 'deserciones_email_folder' && r.value) savedEmailFolder = r.value;
            if (r.key === 'deserciones_email_pass' && r.value && String(r.value).trim().length >= 4) hasSavedPassword = true;
        }
    } catch (_) {}

    res.json({
        isRunning: emailSyncState.isRunning,
        hasBrowserOpen,
        hasSavedPassword,
        savedEmailUser,
        savedEmailFolder,
        currentUrl: emailSyncState.currentUrl || '',
        jobId: emailSyncState.jobId,
        status: emailSyncState.status,
        mfaNumber: emailSyncState.mfaNumber,
        authPrompt: emailSyncState.authPrompt,
        logs: emailSyncState.logs,
        stats: emailSyncState.stats,
        updatedRecords: emailSyncState.updatedRecords
    });
};

const getEmailSyncFrame = async (req, res) => {
    if (emailSyncState.page && !emailSyncState.page.isClosed() && !emailSyncState.lastFrame) {
        await captureFrame();
    }
    res.json({ frame: emailSyncState.lastFrame });
};

const clickEmailSyncPage = async (req, res) => {
    const { x, y, text, key, action } = req.body || {};
    if (!emailSyncState.page || emailSyncState.page.isClosed()) {
        return res.status(400).json({ error: 'No hay navegador de correo activo en este momento. Presione "Iniciar Descarga / Abrir Buzón".' });
    }
    try {
        const page = emailSyncState.page;
        await flushMicrosoftLoginAnimations(page);

        if (action === 'switch_mfa_sms') {
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
                const otherWay = links.find(e => /sign in another way|otra forma| can't use my microsoft authenticator|no puedo usar/i.test(e.innerText || ''));
                if (otherWay) otherWay.click();
            });
            await sleep(1200);
            await flushMicrosoftLoginAnimations(page);
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('div[role="button"], button, a'));
                const sms = links.find(e => /text|sms|mensaje de texto/i.test(e.innerText || ''));
                if (sms) sms.click();
            });
        } else if (action === 'switch_mfa_otp') {
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
                const otherWay = links.find(e => /sign in another way|otra forma|can't use my microsoft authenticator|no puedo usar/i.test(e.innerText || ''));
                if (otherWay) otherWay.click();
            });
            await sleep(1200);
            await flushMicrosoftLoginAnimations(page);
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('div[role="button"], button, a'));
                const otp = links.find(e => /verification code|c[oó]digo de verificaci[oó]n/i.test(e.innerText || ''));
                if (otp) otp.click();
            });
        } else if (action === 'switch_mfa_push') {
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
                const otherWay = links.find(e => /sign in another way|otra forma|can't use/i.test(e.innerText || ''));
                if (otherWay) otherWay.click();
            });
            await sleep(1200);
            await flushMicrosoftLoginAnimations(page);
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('div[role="button"], button, a'));
                const push = links.find(e => /approve a request on my microsoft authenticator|aprobar una solicitud/i.test(e.innerText || ''));
                if (push) push.click();
            });
        } else {
            if (typeof x === 'number' && typeof y === 'number') {
                await page.mouse.click(x, y);
            }
            if (text) {
                await page.keyboard.type(String(text), { delay: 30 });
            }
            if (key) {
                await page.keyboard.press(String(key));
            }
        }
        await sleep(600);
        await flushMicrosoftLoginAnimations(page);
        await captureFrame();
        return res.json({ success: true, frame: emailSyncState.lastFrame });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const sendTextEmailSyncPage = async (req, res) => {
    const { text, submit = true, saveAsPassword = false } = req.body || {};
    if (!emailSyncState.page || emailSyncState.page.isClosed()) {
        return res.status(400).json({ error: 'No hay navegador de correo activo en este momento.' });
    }
    try {
        const page = emailSyncState.page;
        await flushMicrosoftLoginAnimations(page);

        if (saveAsPassword && text && String(text).trim().length >= 8) {
            await pool.query(
                `INSERT INTO system_settings (key, value) VALUES ('deserciones_email_pass', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [String(text).trim()]
            ).catch(() => {});
        }
        // Enfocar automáticamente el campo visible de contraseña o código OTP si existe
        await page.evaluate(() => {
            const input = document.querySelector(
                'input[type="password"]:not([aria-hidden="true"]), input[name="passwd"], input[name="otc"], #idTxtBx_SAOTCC_OTC, input[type="tel"], input[type="email"]'
            );
            if (input && input.offsetParent !== null) {
                input.focus();
                input.value = '';
            }
        });
        if (text) {
            await page.keyboard.type(String(text), { delay: 30 });
        }
        if (submit) {
            await sleep(250);
            const clickedBtn = await page.evaluate(() => {
                const btn = document.querySelector('#idSIButton9, #idSubmit_SAOTCC_Continue, button[type="submit"], input[type="submit"]');
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    return true;
                }
                return false;
            });
            if (!clickedBtn) {
                await page.keyboard.press('Enter');
            }
        }
        await sleep(1400);
        await flushMicrosoftLoginAnimations(page);
        await captureFrame();
        return res.json({ success: true, frame: emailSyncState.lastFrame });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const killEmailSyncBot = async (req, res) => {
    const { close_browser = false } = req.body || {};
    emailSyncState.isRunning = false;
    emailSyncState.status = 'idle';
    if (close_browser) {
        addSyncLog('🛑 Cerrando navegador de correo y reiniciando sesión a petición del usuario.');
        if (emailSyncState.frameTimer) {
            clearInterval(emailSyncState.frameTimer);
            emailSyncState.frameTimer = null;
        }
        if (emailSyncState.browser) {
            try { await emailSyncState.browser.close(); } catch (_) {}
            emailSyncState.browser = null;
            emailSyncState.page = null;
            emailSyncState.lastFrame = null;
        }
        return res.json({ success: true, message: 'Navegador de correo cerrado completamente.' });
    } else {
        addSyncLog('⏸️ Escaneo detenido. Su correo sigue abierto en el servidor.');
        return res.json({ success: true, message: 'Escaneo detenido (el correo sigue abierto en el servidor).' });
    }
};

/**
 * Permite importar radicados desde texto pegado o archivos .eml / .htm / .msg descargados de Outlook
 */
const importManualEmailsOrText = async (req, res) => {
    try {
        const { raw_text = '', items = [], overwrite_existing = true } = req.body || {};
        const extractedRaw = Array.isArray(items) ? [...items] : [];

        if (raw_text && String(raw_text).trim()) {
            const text = String(raw_text);
            const chunks = text.split(/(?=CPE\s*No\.\s*\d{2}-\d-\d{4}-\d+)/i).filter(c => c.trim());
            if (chunks.length > 0) {
                chunks.forEach(chunk => {
                    extractedRaw.push({
                        subject: (chunk.match(/CPE\s*No\.[^\r\n]+/i) || [''])[0],
                        bodyText: chunk,
                        headerText: chunk
                    });
                });
            } else {
                extractedRaw.push({
                    subject: text.slice(0, 200),
                    bodyText: text,
                    headerText: text
                });
            }
        }

        if (Array.isArray(req.files) && req.files.length > 0) {
            for (const f of req.files) {
                try {
                    const content = fs.readFileSync(f.path, 'utf8');
                    extractedRaw.push({
                        subject: (content.match(/Subject:\s*([^\r\n]+)/i) || content.match(/CPE\s*No\.[^\r\n<]+/i) || [f.originalname])[0],
                        bodyText: content.replace(/<[^>]+>/g, ' '),
                        bodyHtml: content,
                        headerText: content.slice(0, 3000)
                    });
                } catch (_) {}
            }
        }

        const syncRes = await syncExtractedEmailsWithDatabase(extractedRaw, { overwriteExisting: overwrite_existing });
        return res.json({
            success: true,
            message: `Se procesaron ${syncRes.totalCpeParsed} notificaciones CPE y se actualizaron ${syncRes.matchedUpdatedCount} aprendices en la base de datos (${syncRes.alreadyUpdatedCount} ya tenían ese mismo radicado).`,
            ...syncRes
        });
    } catch (err) {
        console.error('[DESERCIONES-EMAIL-SYNC] Error en importación manual:', err);
        return res.status(500).json({ error: `Error procesando notificaciones: ${err.message}` });
    }
};

module.exports = {
    executeEmailSyncBot,
    getEmailSyncStatus,
    getEmailSyncFrame,
    clickEmailSyncPage,
    sendTextEmailSyncPage,
    killEmailSyncBot,
    importManualEmailsOrText,
    syncExtractedEmailsWithDatabase,
    parseRawCpeEmail
};
