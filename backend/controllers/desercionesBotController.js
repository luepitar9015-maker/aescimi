const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const { pool } = require('../database_pg');

// ─────────────────────────────────────────────────────────────────
// MOTOR INDEPENDIENTE DEL ROBOT DE DESERCIONES (ONBASE WEB)
// 100% separado de automationController.js (Cargue AES / SGDEA)
// Tiene su propio navegador, sesión, screencast en vivo y control Stop/Kill.
// ─────────────────────────────────────────────────────────────────

const desercionesEmitter = new EventEmitter();
desercionesEmitter.setMaxListeners(30);

const wait = (ms) => new Promise(r => setTimeout(r, ms));

let desercionesBrowser = null;
let desercionesPage = null;
let stopRequested = false;
let lastLockCheckTime = 0;
let recentDialogs = [];

let desercionesJob = {
    running: false,
    jobId: null,
    currentStep: '',
    logs: [],
    error: null,
    completed: false,
    screenshot: null,
    liveFrame: null,
    liveBuffer: null,
    startTime: null,
    activeUser: '',
    totalCasos: 0,
    processedCasos: 0,
    successCasos: 0,
    errorCasos: 0,
    currentCasoId: null,
    inspectionMode: false
};

const safeEval = async (frameOrPage, fn, ...args) => {
    try { return await frameOrPage.evaluate(fn, ...args); } catch { return null; }
};

const safeType = async (page, selector, text, delay = 50) => {
    for (let i = 0; i < 5; i++) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 8000 });
            if (element) {
                const isAttached = await page.evaluate(el => el.isConnected, element).catch(() => false);
                if (isAttached) {
                    await element.click({ clickCount: 3 }).catch(() => {});
                    await wait(150);
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Delete');
                    await wait(150);
                    await element.type(text, { delay });
                    return true;
                }
            }
        } catch (e) {}
        await wait(600);
    }
    return false;
};

const safeClick = async (page, selector) => {
    for (let i = 0; i < 5; i++) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 8000 });
            if (element) {
                const isAttached = await page.evaluate(el => el.isConnected, element).catch(() => false);
                if (isAttached) {
                    await element.click();
                    return true;
                }
            }
        } catch (e) {}
        await wait(600);
    }
    return false;
};

// ─────────────────────────────────────────────────────────────────
// RESOLUCIÓN DINÁMICA DE CUENTAS ONBASE DESDE organization_structure
// ─────────────────────────────────────────────────────────────────
async function loadOrganizationOnBaseAccounts() {
    let orgRows = [];
    try {
        const res = await pool.query('SELECT * FROM organization_structure ORDER BY id ASC');
        orgRows = res.rows || [];
    } catch (e) {
        orgRows = [];
    }

    const findOrg = (subCode) =>
        orgRows.find(o => subCode ? String(o.subsection_code || '').trim() === subCode : (!o.subsection_code || String(o.subsection_code).trim() === '')) || null;

    const orgSub = findOrg('') || { id: 6, section_name: 'Subdirección de Centro', subsection_code: '', onbase_user: 'TVILLAMIZARJ', onbase_pass: 'Sena2026**onbase' };
    const orgAdmin = findOrg('9224.2') || { id: 7, subsection_name: 'Grupo Administración Educativa', subsection_code: '9224.2', onbase_user: 'luepitar', onbase_pass: 'Automatizador2026*' };
    const orgForm = findOrg('9224.4') || { id: 8, subsection_name: 'Grupo de Formación Profesional Integral', subsection_code: '9224.4', onbase_user: 'EDHERNANDEZM', onbase_pass: 'Sena2026**onbase' };

    const getU = (org, fallbackU) => String(org?.onbase_user || org?.onbase_username || fallbackU).trim();
    const getP = (org, fallbackP) => String(org?.onbase_pass || org?.onbase_password || fallbackP).trim();

    const accounts = [
        {
            id: getU(orgForm, 'EDHERNANDEZM'),
            username: getU(orgForm, 'EDHERNANDEZM'),
            depCode: '9224.4',
            depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
            full_name: `${getU(orgForm, 'EDHERNANDEZM')} — Formación Profesional Integral (9224.4)`,
            password: getP(orgForm, 'Sena2026**onbase')
        },
        {
            id: getU(orgAdmin, 'luepitar'),
            username: getU(orgAdmin, 'luepitar'),
            depCode: '9224.2',
            depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
            full_name: `${getU(orgAdmin, 'luepitar')} — Administración Educativa (9224.2)`,
            password: getP(orgAdmin, 'Automatizador2026*')
        },
        {
            id: getU(orgSub, 'TVILLAMIZARJ'),
            username: getU(orgSub, 'TVILLAMIZARJ'),
            depCode: '9224',
            depName: orgSub.section_name || 'Subdirección de Centro',
            full_name: `${getU(orgSub, 'TVILLAMIZARJ')} — Subdirección de Centro (9224)`,
            password: getP(orgSub, 'Sena2026**onbase')
        }
    ];

    return { accounts, orgSub, orgAdmin, orgForm };
}

async function resolveBotCredentials({ username, password, target_user, use_custom_password }) {
    const { accounts } = await loadOrganizationOnBaseAccounts();
    const rawTarget = String(username || target_user || 'EDHERNANDEZM').trim();
    const lower = rawTarget.toLowerCase();

    // Mapear alias históricos (ej. JRROZO -> Subdirección TVILLAMIZARJ)
    let matched = accounts.find(a => a.username.toLowerCase() === lower);
    if (!matched && (lower === 'jrrozo' || lower.includes('subdireccion') || lower === '9224')) {
        matched = accounts.find(a => a.depCode === '9224');
    } else if (!matched && (lower.includes('formacion') || lower === '9224.4')) {
        matched = accounts.find(a => a.depCode === '9224.4');
    } else if (!matched && (lower.includes('administracion') || lower === '9224.2')) {
        matched = accounts.find(a => a.depCode === '9224.2');
    }

    // Contraseñas viejas conocidas de versiones anteriores del frontend que NO deben pisar la clave oficial de BD
    const knownStalePasswords = new Set(['Colombia2026**']);
    const isStaleEdhernandez = matched && matched.username.toUpperCase() === 'EDHERNANDEZM' && password === 'Automatizador2026*' && matched.password !== 'Automatizador2026*';

    if (matched) {
        const finalPass = (use_custom_password && password && !knownStalePasswords.has(password) && !isStaleEdhernandez)
            ? String(password).trim()
            : matched.password;
        return {
            username: matched.username,
            password: finalPass,
            depName: matched.depName,
            depCode: matched.depCode,
            source: use_custom_password ? 'Credencial personalizada' : `Configuración oficial (${matched.depName})`
        };
    }

    return {
        username: rawTarget,
        password: String(password || accounts[0]?.password || '').trim(),
        depName: 'Usuario Personalizado',
        depCode: 'CUSTOM',
        source: 'Credencial explícita'
    };
}

// Endpoint público (sin exponer contraseñas en texto plano) para poblar selector en frontend
exports.getOnBaseAccounts = async (req, res) => {
    try {
        const { accounts } = await loadOrganizationOnBaseAccounts();
        const safeAccounts = accounts.map(({ password, ...rest }) => ({
            ...rest,
            hasStoredPassword: Boolean(password)
        }));
        return res.json({ success: true, accounts: safeAccounts });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// BLOQUEOS Y MODALES ONBASE
// ─────────────────────────────────────────────────────────────────
async function checkAndClearLocks(browser, logs) {
    const now = Date.now();
    if (now - lastLockCheckTime < 1500) return;
    lastLockCheckTime = now;
    try {
        const allPages = await browser.pages().catch(() => []);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const dismissedAttention = await frame.evaluate(() => {
                        const bodyText = (document.body ? document.body.innerText || '' : '').toLowerCase();
                        const isAttention = bodyText.includes('unsaved') || bodyText.includes('require your attention') || bodyText.includes('unfinished work') || bodyText.includes('unsaved data');
                        if (isAttention) {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]'));
                            const contBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                                const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                                return (t === 'continue' || t === 'continuar' || t === 'discard' || t === 'yes' || t === 'sí') && isVisible;
                            });
                            if (contBtn) {
                                contBtn.scrollIntoView({ block: 'center' });
                                contBtn.click();
                                return true;
                            }
                        }
                        return false;
                    });

                    if (dismissedAttention) {
                        logs.push('[ATTENTION] ⚠️ Modal OnBase ("unsaved data") cerrado automáticamente.');
                        await wait(800);
                        return;
                    }

                    const hasLocksPopup = await frame.evaluate(() => {
                        const modal = document.querySelector('.LockedObjects, [id*="Lock" i], [class*="Lock" i], .ui-dialog');
                        if (!modal) return false;
                        const txt = (modal.innerText || '').toLowerCase();
                        return (txt.includes('locked objects') || txt.includes('manage locks') || txt.includes('objetos bloqueados')) && txt.includes('lock type');
                    });

                    if (hasLocksPopup) {
                        logs.push('[LOCKS] ⚠️ Liberando objetos bloqueados en OnBase...');
                        const action = await frame.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                            const selectAllBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('select all') || t.includes('seleccionar todo');
                            });
                            if (selectAllBtn) { selectAllBtn.click(); return 'select_all'; }
                            const removeBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                            });
                            if (removeBtn) { removeBtn.click(); return 'remove_lock'; }
                            return null;
                        });

                        if (action) {
                            await wait(1200);
                            if (action === 'select_all') {
                                await frame.evaluate(() => {
                                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                                    const removeBtn = buttons.find(b => {
                                        const t = (b.innerText || b.value || '').trim().toLowerCase();
                                        return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                                    });
                                    if (removeBtn) removeBtn.click();
                                });
                                await wait(1500);
                            }
                            await frame.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div, img'));
                                const closeBtn = buttons.find(b => {
                                    const t = (b.innerText || b.value || '').trim().toLowerCase();
                                    return t === 'x' || t === 'close' || t === 'cerrar' || t === 'cancel' || t === 'cancelar' || b.className?.includes('close') || b.id?.includes('close');
                                });
                                if (closeBtn) closeBtn.click();
                            });
                            await wait(800);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (err) {}
}

// ─────────────────────────────────────────────────────────────────
// PASO 1: LOGIN ONBASE WEB (CON MICROSOFT SSO + SESSION TAKEOVER)
// ─────────────────────────────────────────────────────────────────
async function paso1_login(page, url, username, password, logs) {
    logs.push(`[PASO 1] Navegando a OnBase Web (${url})...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        .catch(e => logs.push(`[PASO 1][WARN] goto: ${e.message}`));
    await wait(2500);

    let isMicrosoftSSO = false;
    for (let i = 0; i < 4; i++) {
        try {
            isMicrosoftSSO = page.url().includes('microsoftonline.com') || await page.evaluate(() => {
                return window.location.href.includes('microsoftonline.com') ||
                       document.title.includes('Iniciar sesión') ||
                       document.title.includes('Sign in') ||
                       !!document.querySelector('input[name="loginfmt"]');
            });
            break;
        } catch (e) {
            await wait(1500);
        }
    }

    if (isMicrosoftSSO) {
        logs.push('[PASO 1] Detectado inicio de sesión Microsoft SSO.');
        let effectiveUsername = username.includes('@') ? username : `${username}@sena.edu.co`;
        const emailOk = await safeType(page, 'input[type="email"], input[name="loginfmt"], #i0116', effectiveUsername, 50);
        if (!emailOk) {
            logs.push('[PASO 1][ERROR] Campo de correo SSO no encontrado.');
            return false;
        }
        const nextOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!nextOk) {
            logs.push('[PASO 1][ERROR] Botón Siguiente SSO no encontrado.');
            return false;
        }
        await wait(2000);

        const passOk = await safeType(page, 'input[type="password"], input[name="passwd"], #i0118', password, 50);
        if (!passOk) {
            logs.push('[PASO 1][ERROR] Campo de contraseña SSO no encontrado.');
            return false;
        }
        const submitOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!submitOk) {
            logs.push('[PASO 1][ERROR] Botón Iniciar Sesión SSO no encontrado.');
            return false;
        }
        await wait(4500);

        const staySignedIn = await page.evaluate(() => {
            const hasStayText = document.body ? (document.body.innerText.includes('mantener la sesión') || document.body.innerText.includes('Stay signed in')) : false;
            return hasStayText && !!document.querySelector('#idBtn_Back');
        }).catch(() => false);

        if (staySignedIn) {
            const noBtn = await page.$('#idBtn_Back');
            if (noBtn) await noBtn.click();
            await wait(4000);
        }
    } else {
        logs.push(`[PASO 1] Autenticando usuario "${username}" en login estándar OnBase...`);
        const userOk = await safeType(page, '#username, input[type="text"], input[name="username"]', username, 45);
        if (!userOk) {
            logs.push('[PASO 1][ERROR] Campo de usuario no encontrado.');
            return false;
        }
        const passOk = await safeType(page, '#password, input[type="password"]', password, 45);
        if (!passOk) {
            logs.push('[PASO 1][ERROR] Campo de contraseña no encontrado.');
            return false;
        }
        const loginBtn = await page.$('#loginButton, button[type="submit"], input[type="submit"]');
        if (loginBtn) await loginBtn.click();
        else await page.keyboard.press('Enter');
        logs.push('[PASO 1] Credenciales enviadas. Esperando acceso...');
    }

    await wait(3500);
    const takeoverButtonSelector = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText.toLowerCase() : '';
        const hasSessionText = txt.includes('iniciada') || txt.includes('already logged in') || txt.includes('sesión activa') || txt.includes('active session') || txt.includes('already has an active') || txt.includes('user is logged in');
        if (hasSessionText) {
            const elements = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a, span, div'));
            const acceptBtn = elements.find(el => {
                const val = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
                return val === 'yes' || val === 'si' || val === 'sí' || val === 'aceptar' || val.includes('take') || val.includes('contin') || val.includes('login anyway');
            });
            if (acceptBtn) {
                acceptBtn.id = acceptBtn.id || 'temp_takeover_btn';
                return '#' + acceptBtn.id;
            }
        }
        return null;
    }).catch(() => null);

    if (takeoverButtonSelector) {
        logs.push('[PASO 1] ⚠️ Sesión previa detectada en OnBase. Tomando control de la sesión...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 25000 }).catch(() => {}),
            page.click(takeoverButtonSelector)
        ]);
        await wait(5000);
    } else {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
        await wait(2500);
    }

    const postUrl = page.url();
    logs.push(`[PASO 1] URL activa: ${postUrl}`);

    if (postUrl.includes('NavPanel') || postUrl.includes('Dashboard') || postUrl.includes('Home') || postUrl.toLowerCase().includes('document/query')) {
        logs.push('[PASO 1] ✅ Autenticación exitosa en OnBase Web.');
        await checkAndClearLocks(page.browser(), logs).catch(() => {});
        return true;
    }

    const errMsg = await safeEval(page, () => {
        const el = document.querySelector('#ErrorMessage, .error-message, [class*="error"], #error-information, .error');
        return el ? el.innerText.trim() : null;
    });
    logs.push(`[PASO 1][ERROR] Falló inicio de sesión: ${errMsg || 'Credenciales inválidas o sesión bloqueada.'}`);
    return false;
}

// ─────────────────────────────────────────────────────────────────
// PASO 3: ABRIR "UForm Comunicación Electrónica" Y MARCAR "EXTERNO"
// ─────────────────────────────────────────────────────────────────
async function paso3_uformComunicacionElectronica(page, browser, logs) {
    logs.push('[PASO 3] Abriendo catálogo "Nuevo formulario" -> "UForm Comunicación Electrónica"...');
    await checkAndClearLocks(browser, logs).catch(() => {});
    await wait(150);

    // 0. Asegurar que el panel de Nuevo Formulario esté abierto (si está en Document Retrieval o si acaba de enviar un formulario previo)
    for (let attempt = 0; attempt < 5; attempt++) {
        const switched = await page.evaluate(() => {
            const txt = document.body ? document.body.innerText.toLowerCase() : '';
            const hasCatalog = txt.includes('comunicaciones producidas') || txt.includes('uform comunicacion electronica') || txt.includes('uform comunicación electrónica');
            if (hasCatalog) return 'Catálogo de formularios ya visible';

            const gridBtn = document.querySelector(
                '#newform, [id*="NewForm" i], [id*="newform" i], [onclick*="NewForm" i], ' +
                '[title*="Nuevo formulario" i], [title*="New Form" i], [aria-label*="Form" i], ' +
                'a.navMenu, span.icon-grid, i.fa-th, i.icon-grid, .icon-apps, span.app-icon'
            );
            if (gridBtn) {
                gridBtn.click();
                return 'Botón Nuevo Formulario cliqueado';
            }

            const allClickables = Array.from(document.querySelectorAll('a, li, button, span, div'));
            const newFormBtn = allClickables.find(el => {
                const t = (el.title || el.getAttribute('aria-label') || el.innerText || '').trim().toLowerCase();
                return t === 'nuevo formulario' || t === 'new form' || t.includes('nuevo formulario');
            });
            if (newFormBtn) {
                newFormBtn.click();
                return 'Enlace Nuevo Formulario cliqueado';
            }
            return null;
        }).catch(() => null);

        if (switched) {
            if (!switched.includes('ya visible')) {
                logs.push(`[PASO 3] ✅ ${switched}`);
                await wait(450);
            }
            break;
        }
        await wait(200);
    }

    // 1. Seleccionar con doble clic "UForm Comunicacion Electronica"
    let itemClicked = false;
    let clickCoords = null;

    for (let attempt = 0; attempt < 20 && !itemClicked; attempt++) {
        if (stopRequested) throw new Error('Proceso detenido por el usuario.');
        await wait(attempt === 0 ? 150 : 280);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    await frame.evaluate(() => {
                        const headers = Array.from(document.querySelectorAll('a, li, span, td, div, label'));
                        const header = headers.find(el => (el.innerText || el.textContent || '').trim().toUpperCase() === 'COMUNICACIONES PRODUCIDAS');
                        if (header) header.click();
                    }).catch(() => {});

                    const actionRes = await frame.evaluate(() => {
                        let el = document.querySelector('#itemLabelunity118, #liunity118, [id*="unity118"]');
                        if (!el) {
                            const candidates = Array.from(document.querySelectorAll('a, li, span, td, div, label, [role="treeitem"]'));
                            el = candidates.find(c => {
                                const t = (c.innerText || c.textContent || '').trim().toLowerCase();
                                return (
                                    t.includes('uform comunicacion electronica') ||
                                    t.includes('uform comunicación electrónica') ||
                                    t.includes('01-ufrm comunicacion electronica')
                                ) && c.offsetParent !== null;
                            });
                        }
                        if (el) {
                            el.scrollIntoView({ block: 'center' });
                            const r = el.getBoundingClientRect();
                            if (r.width === 0 && r.height === 0) return null;
                            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                            el.click();
                            return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: (el.innerText || el.textContent || '').trim() };
                        }
                        return null;
                    });

                    if (actionRes) {
                        let fOffsetX = 0, fOffsetY = 0;
                        try {
                            const fEl = await frame.frameElement();
                            const fBox = await fEl.boundingBox();
                            if (fBox) { fOffsetX = fBox.x; fOffsetY = fBox.y; }
                        } catch (e) {}

                        await pg.mouse.click(fOffsetX + actionRes.x, fOffsetY + actionRes.y, { clickCount: 2 });
                        logs.push(`[PASO 3] ✅ Doble clic en "${actionRes.text}".`);
                        itemClicked = true;
                        clickCoords = { x: fOffsetX + actionRes.x, y: fOffsetY + actionRes.y, pg };
                        break;
                    }
                } catch (e) {}
            }
            if (itemClicked) break;
        }
    }

    if (!itemClicked) {
        throw new Error('No se encontró el formulario "UForm Comunicación Electrónica" en el catálogo de OnBase.');
    }

    // 2. Esperar carga real de inputs limpios del formulario
    let formLoadedFrame = null;
    for (let attempt = 0; attempt < 60 && !formLoadedFrame; attempt++) {
        if (stopRequested) throw new Error('Proceso detenido por el usuario.');
        await wait(400);
        await checkAndClearLocks(browser, logs).catch(() => {});
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const ready = await frame.evaluate(() => {
                        const txt = document.body ? document.body.innerText.toLowerCase() : '';
                        const href = (window.location && window.location.href) || '';
                        const hasInputs = document.querySelectorAll('input, select, textarea').length > 3;
                        const isNotNothing = !txt.includes('nothing to display');
                        const isTarget = href.includes('UnityFormHandler.ashx') ||
                                         document.getElementById('destinatarioexterno24_input') ||
                                         document.getElementById('mailto_input') ||
                                         document.getElementById('asunto27_input') ||
                                         document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4') ||
                                         txt.includes('tipo de destinatario') ||
                                         txt.includes('destinatario externo');
                        return Boolean(isTarget && hasInputs && isNotNothing);
                    });
                    if (ready) {
                        formLoadedFrame = frame;
                        break;
                    }
                } catch (e) {}
            }
            if (formLoadedFrame) break;
        }

        if ((attempt === 8 || attempt === 18) && !formLoadedFrame && clickCoords) {
            logs.push('[PASO 3] Reintentando apertura de "UForm Comunicación Electrónica"...');
            await clickCoords.pg.mouse.click(clickCoords.x, clickCoords.y, { clickCount: 2 }).catch(() => {});
        }
    }

    if (!formLoadedFrame) {
        throw new Error('Tiempo de espera agotado (24s) esperando carga del formulario "UForm Comunicación Electrónica".');
    }

    logs.push('[PASO 3] ✅ Formulario cargado. Seleccionando destinatario "Externo"...');

    // 3. Seleccionar radio "Externo"
    let selectedExterno = false;
    for (let attempt = 0; attempt < 15 && !selectedExterno; attempt++) {
        await wait(150);
        const res = await formLoadedFrame.evaluate(() => {
            const directRadio = document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
            if (directRadio) {
                directRadio.scrollIntoView({ block: 'center' });
                directRadio.click();
                directRadio.checked = true;
                directRadio.dispatchEvent(new Event('change', { bubbles: true }));
                directRadio.dispatchEvent(new Event('click', { bubbles: true }));
                return 'Radio Externo directo';
            }
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
            const radioExterno = radios.find(r => {
                const val = (r.value || r.id || r.name || r.title || '').toLowerCase();
                const nextText = (r.nextSibling?.textContent || r.parentElement?.textContent || '').toLowerCase();
                return (val.includes('externo') || nextText.includes('externo')) && !val.includes('copia');
            });
            if (radioExterno) {
                radioExterno.scrollIntoView({ block: 'center' });
                radioExterno.click();
                radioExterno.checked = true;
                radioExterno.dispatchEvent(new Event('change', { bubbles: true }));
                return 'Radio Externo localizado';
            }
            return null;
        }).catch(() => null);

        if (res) {
            selectedExterno = true;
            logs.push(`[PASO 3] ✅ Tipo de destinatario "Externo" activo (${res}).`);
            break;
        }
    }

    return formLoadedFrame;
}

// ─────────────────────────────────────────────────────────────────
// VALIDACIÓN PRE-VUELO Y RESOLUCIÓN DE ANEXOS PDF
// ─────────────────────────────────────────────────────────────────
function resolverRutaLocalPDF(ruta) {
    if (!ruta || typeof ruta !== 'string') return null;
    const trimmed = ruta.trim();
    if (!trimmed) return null;
    if (fs.existsSync(trimmed)) return trimmed;

    const cleanRel = trimmed.replace(/^[/\\]+/, '');
    const filename = path.basename(trimmed);
    if (!filename) return null;

    const candidates = [
        path.join(__dirname, '..', cleanRel),
        path.join(__dirname, '..', 'uploads', 'deserciones', filename),
        path.join(__dirname, '..', 'uploads', 'deserciones_pdf', filename),
        path.join(__dirname, '..', 'uploads', filename),
        path.join(process.cwd(), cleanRel),
        path.join(process.cwd(), 'uploads', 'deserciones', filename),
        path.join(process.cwd(), 'uploads', 'deserciones_pdf', filename),
        path.join(process.cwd(), 'uploads', filename)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return null;
}

function findUnmergedTokens(str) {
    if (!str || typeof str !== 'string') return [];
    const matches = str.match(/(\{\{\s*[^}]+\s*\}\}|«\s*[^»]+\s*»|<<\s*[^>]+>>)/g);
    return matches ? Array.from(new Set(matches)) : [];
}

function validateAndNormalizeCaso(casoData, opts = {}) {
    const nombreAprendiz = String(
        casoData.aprendiz_nombre ||
        `${casoData.aprendiz_nombres || ''} ${casoData.aprendiz_apellidos || ''}`.trim() ||
        casoData.raw_row?.['NOMBRE'] ||
        casoData.raw_row?.['NOMBRES'] ||
        casoData.raw_row?.['APRENDIZ'] ||
        ''
    ).trim();

    if (!nombreAprendiz) {
        throw new Error('El nombre del aprendiz destinatario está vacío.');
    }

    const emailAprendiz = String(
        casoData.aprendiz_correo ||
        casoData.correo ||
        casoData.email ||
        casoData.aprendiz_email ||
        casoData.raw_row?.['CORREO REGISTRADO EN SOFÍA'] ||
        casoData.raw_row?.['CORREO REGISTRADO EN SOFIA'] ||
        casoData.raw_row?.['CORREO'] ||
        casoData.raw_row?.['EMAIL'] ||
        ''
    ).trim();

    if (!emailAprendiz || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailAprendiz)) {
        throw new Error(`Correo electrónico del aprendiz inválido o vacío: "${emailAprendiz || 'SIN CORREO'}".`);
    }

    const asuntoVal = String(casoData.asunto || 'NOVEDADES DE ALUMNOS').trim();
    let descAsuntoVal = String(casoData.descripcion_asunto || 'Notificación').trim();
    const textoCombinado = String(casoData.texto_combinado || casoData.texto_inicial || '').trim();

    if (!textoCombinado) {
        throw new Error('El cuerpo del texto combinado de la comunicación está vacío.');
    }

    // Auto-recuperación inteligente si un registro histórico tenía {{RESOLUCION}} en descripcion_asunto pero sí estaba combinado en la línea "Asunto:" de la carta
    if (findUnmergedTokens(descAsuntoVal).length > 0) {
        const asuntoLineMatch = textoCombinado.match(/^\s*Asunto:\s*(.+)$/im);
        if (asuntoLineMatch && asuntoLineMatch[1] && findUnmergedTokens(asuntoLineMatch[1]).length === 0) {
            descAsuntoVal = asuntoLineMatch[1].trim();
        }
    }

    const remainingTokens = [
        ...findUnmergedTokens(asuntoVal),
        ...findUnmergedTokens(descAsuntoVal),
        ...findUnmergedTokens(textoCombinado)
    ];

    if (remainingTokens.length > 0 && !opts.solo_diligenciar) {
        throw new Error(`Quedan variables sin combinar (${remainingTokens.join(', ')}). Verifique que los nombres coincidan con el Excel antes de radicar.`);
    }

    // REGLA OFICIAL SENA: Las Citaciones a Comité (CITACION_COMITE) NO llevan anexo PDF en OnBase (solo cuerpo de texto).
    // Únicamente las Notificaciones de Resolución (NOTIFICACION_RESOLUCION) adjuntan el PDF del acto administrativo.
    const filesToAttach = [];
    if (casoData.etapa === 'NOTIFICACION_RESOLUCION') {
        const localAnexo = resolverRutaLocalPDF(casoData.anexo_path);
        if (casoData.anexo_path && String(casoData.anexo_path).trim() && !localAnexo) {
            throw new Error(`El archivo anexo asignado no se encuentra en el servidor: "${path.basename(String(casoData.anexo_path))}".`);
        }
        if (localAnexo) filesToAttach.push(localAnexo);

        const localPdfCom = resolverRutaLocalPDF(casoData.comunicacion_pdf_path);
        if (localPdfCom && !filesToAttach.includes(localPdfCom)) {
            filesToAttach.push(localPdfCom);
        }

        if (filesToAttach.length === 0 && !opts.solo_diligenciar) {
            throw new Error('Falta el PDF adjunto de la Resolución (obligatorio para Notificación de Resolución).');
        }
    }

    // Respetar límites de longitud de Unity Form OnBase (destinatarioexterno24 <= 60, asunto27 <= 60, descripcionasunto28 <= 150)
    const cleanNombreAprendiz = nombreAprendiz.slice(0, 60).trim();
    const cleanAsuntoVal = asuntoVal.slice(0, 60).trim();
    const cleanDescAsuntoVal = descAsuntoVal.slice(0, 150).trim();

    return {
        nombreAprendiz: cleanNombreAprendiz,
        emailAprendiz,
        asuntoVal: cleanAsuntoVal,
        descAsuntoVal: cleanDescAsuntoVal,
        textoCombinado,
        filesToAttach
    };
}

// ─────────────────────────────────────────────────────────────────
// PASO 4: DILIGENCIAR, VERIFICAR ADJUNTO, ENVIAR Y CAPTURAR RADICADO/NIS
// ─────────────────────────────────────────────────────────────────
async function paso4_diligenciarComunicacionElectronica(page, browser, casoData, logs, opts = {}) {
    const validated = validateAndNormalizeCaso(casoData, opts);
    const { nombreAprendiz, emailAprendiz, asuntoVal, descAsuntoVal, textoCombinado, filesToAttach } = validated;

    logs.push(`[PASO 4] Diligenciando comunicación para "${nombreAprendiz}" <${emailAprendiz}>...`);
    await wait(200);

    let formFrame = opts.formFrame || null;
    if (!formFrame || formFrame.isDetached?.()) {
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const isTarget = await frame.evaluate(() => {
                        return Boolean(
                            document.getElementById('destinatarioexterno24_input') ||
                            document.getElementById('mailto_input') ||
                            document.getElementById('asunto27_input') ||
                            document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4') ||
                            ((window.location?.href || '').includes('UnityFormHandler.ashx') && document.querySelectorAll('input').length > 5)
                        );
                    });
                    if (isTarget) { formFrame = frame; break; }
                } catch (e) {}
            }
            if (formFrame) break;
        }
    }

    if (!formFrame) {
        throw new Error('No se encontró el frame activo del formulario "UForm Comunicación Electrónica".');
    }

    const locatorScript = `
        function setNativeValue(input, val) {
            if (!input) return false;
            input.focus();
            try { input.click(); } catch(e){}
            const tag = input.tagName.toLowerCase();
            if (tag === 'select') {
                const opts = Array.from(input.options);
                const matchOpt = opts.find(o => (o.text || '').toLowerCase().includes(val.toLowerCase()) || (o.value || '').toLowerCase().includes(val.toLowerCase()));
                if (matchOpt) input.value = matchOpt.value;
                else if (opts.length > 1) input.selectedIndex = 1;
            } else if (tag === 'textarea') {
                const nativeTaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (nativeTaSetter) nativeTaSetter.call(input, val);
                else input.value = val;
            } else {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) nativeSetter.call(input, val);
                else input.value = val;
                input.setAttribute('value', val);
            }
            if (window.$) {
                try {
                    window.$(input).val(val).trigger('input').trigger('change').trigger('blur');
                } catch(e){}
            }
            for (const evtName of ['input', 'keydown', 'keyup', 'change', 'blur']) {
                try { input.dispatchEvent(new Event(evtName, { bubbles: true, cancelable: true })); } catch(e){}
            }
            return true;
        }
    `;

    // 1. Asegurar Radio Externo
    await formFrame.evaluate(() => {
        const rExterno = document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
        if (rExterno) {
            rExterno.click();
            rExterno.checked = true;
            rExterno.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }).catch(() => {});
    await wait(200);

    // 2. Nombre y Email Destinatario (y esperar validación de correo de OnBase #correovalido_input = True)
    await formFrame.evaluate((nombre, email, helperStr) => {
        eval(helperStr);
        const nameInp = document.getElementById('destinatarioexterno24_input') ||
                        document.querySelector('input[id*="destinatarioexterno"]:not([id*="copia"])');
        if (nameInp) setNativeValue(nameInp, nombre);
        const emailInp = document.getElementById('mailto_input') ||
                         document.querySelector('input[id*="mailto"]');
        if (emailInp) setNativeValue(emailInp, email);
    }, nombreAprendiz, emailAprendiz, locatorScript).catch(() => {});

    // Esperar a que el CustomAction de OnBase ('Validar Email Destinatario', operationID 130) confirme #correovalido_input
    for (let w = 0; w < 10; w++) {
        const cv = await formFrame.evaluate(() => {
            const el = document.getElementById('correovalido_input');
            return el ? (el.value || '').trim() : '';
        }).catch(() => '');
        if (cv === 'True') break;
        await wait(200);
    }

    logs.push(`[PASO 4] ✅ 1-2/8 Destinatario "${nombreAprendiz}" y Correo "${emailAprendiz}" establecidos y validados.`);

    // 3. Asunto ('NOVEDADES DE ALUMNOS') — Selección determinística desde el Data Set de Unity Form (#asunto27)
    // IMPORTANTE: No usar page.keyboard.type concurrente para evitar colisión de foco con #descripcionasunto28_input.
    const selectAsuntoFromDataSet = async (targetAsunto) => {
        // Abrir el menú autocomplete de #asunto27 haciendo clic en su botón combobox o invocando jQuery autocomplete('search')
        await formFrame.evaluate((asunto) => {
            const asuntoInp = document.getElementById('asunto27_input');
            if (!asuntoInp) return;
            asuntoInp.focus();
            asuntoInp.value = '';
            if (window.$ && window.$(asuntoInp).autocomplete) {
                try {
                    window.$(asuntoInp).val(asunto);
                    window.$(asuntoInp).autocomplete('search', asunto);
                } catch (e) {}
            }
            const dropBtn = document.querySelector('#asunto27 button.comboboxbutton, button[aria-label="Asunto drop down"]');
            if (dropBtn && (! document.querySelector('[hsi-automation="automation-asunto27-menu"] li'))) {
                try { dropBtn.click(); } catch (e) {}
            }
        }, targetAsunto).catch(() => {});

        let selected = false;
        for (let poll = 0; poll < 16 && !selected; poll++) {
            await wait(220);
            selected = await formFrame.evaluate((asunto) => {
                const menuItems = Array.from(document.querySelectorAll(
                    '[hsi-automation="automation-asunto27-menu"] .ui-menu-item-wrapper, ' +
                    '[hsi-automation="automation-asunto27-menu"] li, ' +
                    'ul.ui-autocomplete .ui-menu-item-wrapper, ' +
                    'ul.ui-autocomplete li.ui-menu-item'
                ));
                const targetUpper = asunto.toUpperCase().trim();
                const exact = menuItems.find(el => (el.innerText || el.textContent || '').trim().toUpperCase() === targetUpper)
                    || menuItems.find(el => (el.innerText || el.textContent || '').trim().toUpperCase().includes(targetUpper));
                if (exact) {
                    exact.scrollIntoView({ block: 'nearest' });
                    exact.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                    exact.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                    exact.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    exact.click();
                    exact.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    const asuntoInp = document.getElementById('asunto27_input');
                    if (asuntoInp) {
                        asuntoInp.blur();
                        if (window.$) {
                            try { window.$(asuntoInp).trigger('change').trigger('blur'); } catch (e) {}
                        }
                    }
                    return true;
                }
                return false;
            }, targetAsunto).catch(() => false);
        }

        // Esperar a que termine el indicador AJAX de #asunto27 y verificar que NO tenga clase invalid_field
        for (let w = 0; w < 12; w++) {
            await wait(200);
            const state = await formFrame.evaluate((asunto) => {
                const div = document.getElementById('asunto27');
                const inp = document.getElementById('asunto27_input');
                const ind = div ? div.querySelector('.action_indicator') : null;
                const busy = ind && ind.style && ind.style.display !== 'none';
                const invalid = div ? div.classList.contains('invalid_field') : false;
                const val = inp ? (inp.value || '').trim() : '';
                return { busy, invalid, val };
            }, targetAsunto).catch(() => ({ busy: false, invalid: false, val: targetAsunto }));
            if (!state.busy && !state.invalid && state.val.toUpperCase() === targetAsunto.toUpperCase()) {
                return true;
            }
        }
        return false;
    };

    let asuntoValid = await selectAsuntoFromDataSet(asuntoVal);
    if (!asuntoValid) {
        // Segundo intento abriendo el desplegable completo de Asunto y seleccionando el ítem exacto
        await formFrame.evaluate(() => {
            const dropBtn = document.querySelector('#asunto27 button.comboboxbutton, button[aria-label="Asunto drop down"]');
            if (dropBtn) dropBtn.click();
        }).catch(() => {});
        await wait(450);
        await selectAsuntoFromDataSet(asuntoVal);
    }
    logs.push(`[PASO 4] ✅ 3/8 Asunto seleccionado del catálogo OnBase: "${asuntoVal}".`);

    // 4. Descripción del Asunto (inyección nativa + jQuery sin tecleo asíncrono que robe el foco a #asunto27)
    await formFrame.evaluate((desc, helperStr) => {
        eval(helperStr);
        const descInp = document.getElementById('descripcionasunto28_input') || document.querySelector('input[id*="descripcionasunto"]');
        if (descInp) setNativeValue(descInp, desc);
    }, descAsuntoVal, locatorScript).catch(() => {});
    logs.push(`[PASO 4] ✅ 4/8 Descripción del Asunto: "${descAsuntoVal}".`);

    // 5. Cuerpo de Texto (Carta Combinada)
    const bodyOk = await formFrame.evaluate((texto, helperStr) => {
        eval(helperStr);
        const textoInp = document.getElementById('ctxt_cuerpo_input') ||
                         document.querySelector('textarea.check_visibility') ||
                         document.querySelector('textarea');
        return textoInp ? setNativeValue(textoInp, texto) : false;
    }, textoCombinado, locatorScript).catch(() => false);

    if (!bodyOk) {
        throw new Error('No se encontró el campo de cuerpo de texto (#ctxt_cuerpo_input) en el formulario OnBase.');
    }
    logs.push(`[PASO 4] ✅ 5/8 Cuerpo de la comunicación combinada insertado (${textoCombinado.length} caracteres).`);
    await wait(150);

    // 6. Adjuntar Anexo(s) PDF (SOLO para NOTIFICACION_RESOLUCION; CITACION_COMITE nunca lleva anexo)
    if (filesToAttach.length > 0) {
        for (let fIdx = 0; fIdx < filesToAttach.length; fIdx++) {
            const pdfFile = filesToAttach[fIdx];
            const basePdfName = path.basename(pdfFile);
            logs.push(`[PASO 4] 6/8 Adjuntando PDF de Resolución (${fIdx + 1}/${filesToAttach.length}): "${basePdfName}"...`);

            let attachedSuccess = false;
            const attachBtnHandle = await formFrame.$('#attachment68_container_button, .file_input_button, input[value*="Adjuntar"]').catch(() => null);

            if (attachBtnHandle) {
                try {
                    const fcPromise = page.waitForFileChooser({ timeout: 4000 }).catch(() => null);
                    await attachBtnHandle.click().catch(() => {});
                    const fileChooser = await fcPromise;
                    if (fileChooser) {
                        await fileChooser.accept([pdfFile]);
                        attachedSuccess = true;
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                try {
                    const fileInputs = await formFrame.$$('input[type="file"]');
                    for (const fInput of (fileInputs || [])) {
                        await fInput.uploadFile(pdfFile);
                        attachedSuccess = true;
                        break;
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                throw new Error(`No fue posible adjuntar el archivo PDF "${basePdfName}" en el control de anexos de OnBase.`);
            }

            await wait(1400);
            for (let poll = 0; poll < 12; poll++) {
                const uploadState = await formFrame.evaluate((fname) => {
                    const txt = (document.body?.innerText || '').toLowerCase();
                    const isUploading = txt.includes('uploading') || txt.includes('subiendo') || txt.includes('cargando archivo') || !!document.querySelector('.uploading, .loading-spinner, .ajax-loader');
                    const hasName = txt.includes(fname.toLowerCase()) || Array.from(document.querySelectorAll('input[type="file"], .attachment, [id*="attachment" i]')).some(el => {
                        const v = (el.value || el.innerText || el.textContent || '').toLowerCase();
                        return v.includes(fname.toLowerCase()) || v.includes('.pdf');
                    });
                    return { isUploading, hasName };
                }, basePdfName).catch(() => ({ isUploading: false, hasName: true }));

                if (!uploadState.isUploading && uploadState.hasName) break;
                await wait(350);
            }

            logs.push(`[PASO 4] ✅ 6/8 Archivo PDF "${basePdfName}" adjuntado y verificado.`);
        }
    } else {
        logs.push('[PASO 4] ℹ️ 6/8 Citación sin anexo PDF (solo cuerpo de texto en OnBase).');
    }

    // 7. Copias Externas (CC) — Incluye automáticamente al Acudiente exclusivo de este aprendiz + Copias Institucionales
    let copyEmailsList = [];
    if (casoData.copy_emails) {
        try {
            copyEmailsList = typeof casoData.copy_emails === 'string' ? JSON.parse(casoData.copy_emails) : casoData.copy_emails;
        } catch (e) {}
    }
    copyEmailsList = (Array.isArray(copyEmailsList) ? copyEmailsList : []).filter(cc => cc && cc.email && String(cc.email).includes('@'));

    if (copyEmailsList.length === 0) {
        try {
            const ccSetRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_cc_emails' LIMIT 1");
            if (ccSetRes.rows?.[0]?.value) {
                const parsed = JSON.parse(ccSetRes.rows[0].value);
                if (Array.isArray(parsed)) {
                    copyEmailsList = parsed.filter(cc => cc && cc.email && String(cc.email).includes('@'));
                }
            }
        } catch (e) {}
    }
    if (copyEmailsList.length === 0) {
        copyEmailsList = [
            { name: 'Manuel Valencia', email: 'mevalencia@sena.edu.co' },
            { name: 'Monica Gomez', email: 'mlgomez@sena.edu.co' },
            { name: 'Luis Ernesto Parada Moreno', email: 'leparadam@sena.edu.co' }
        ];
    }

    // Inyección dinámica e independiente del correo del Acudiente propio de ESTE caso (si está en acudiente_correo o raw_row)
    const rawAcudienteCorreo = String(
        casoData.acudiente_correo ||
        casoData.raw_row?.['CORREO ACUDIENTE'] ||
        casoData.raw_row?.['EMAIL ACUDIENTE'] ||
        casoData.raw_row?.['CORREO REPRESENTANTE'] ||
        ''
    ).trim();
    const rawAcudienteNombre = String(
        casoData.acudiente_nombre ||
        casoData.raw_row?.['NOMBRE ACUDIENTE'] ||
        casoData.raw_row?.['ACUDIENTE'] ||
        casoData.raw_row?.['REPRESENTANTE LEGAL'] ||
        ''
    ).trim() || `Acudiente de ${nombreAprendiz}`;

    if (rawAcudienteCorreo && rawAcudienteCorreo.includes('@')) {
        const acParts = rawAcudienteCorreo.split(/[;,]+/).map(s => s.trim()).filter(s => s.includes('@'));
        for (let aIdx = acParts.length - 1; aIdx >= 0; aIdx--) {
            const acMail = acParts[aIdx];
            const alreadyInCc = copyEmailsList.some(c => String(c.email || '').trim().toLowerCase() === acMail.toLowerCase());
            if (!alreadyInCc) {
                copyEmailsList.unshift({
                    name: rawAcudienteNombre,
                    email: acMail,
                    is_acudiente: true
                });
            }
        }
        logs.push(`[PASO 4] 👨‍👩‍👦 Copia independiente a Acudiente activada para este aprendiz: "${rawAcudienteNombre}" <${rawAcudienteCorreo}>.`);
    }

    if (copyEmailsList.length > 0) {
        logs.push(`[PASO 4] 7/8 Registrando ${copyEmailsList.length} correo(s) en Copias Externas (CC)...`);
        try {
            // Asegurar exactamente copyEmailsList.length filas visibles (_Row_0, _Row_1, ...) en Copias Externas
            for (let i = 0; i < copyEmailsList.length; i++) {
                const currentVisibleRows = await formFrame.evaluate(() => {
                    return document.querySelectorAll('input[id^="destinatarioexternocopia55_input_Row_"]').length;
                }).catch(() => 0);

                if (currentVisibleRows < copyEmailsList.length) {
                    await formFrame.evaluate(() => {
                        const rep = document.getElementById('copiadestinatarioexternoemail')
                            || document.querySelector('[id*="copiadestinatarioexterno"]');
                        if (rep) {
                            const addBtn = rep.querySelector('input.addItem, button.addItem, .addItem');
                            if (addBtn) {
                                addBtn.scrollIntoView({ block: 'center' });
                                addBtn.click();
                                return true;
                            }
                        }
                        const addBtns = Array.from(document.querySelectorAll('input.addItem, button.addItem, .addItem'));
                        if (addBtns.length >= 2) { addBtns[1].click(); return true; }
                        return false;
                    }).catch(() => {});
                    await wait(300);
                }
            }

            // Limpiar por seguridad la plantilla oculta por si tenía algún valor residual
            await formFrame.evaluate(() => {
                const tplName = document.getElementById('destinatarioexternocopia55_input');
                const tplMail = document.getElementById('mailcc_input');
                if (tplName && tplName.offsetParent === null) tplName.value = '';
                if (tplMail && tplMail.offsetParent === null) tplMail.value = '';
            }).catch(() => {});

            // Diligenciar cada fila visible _Row_0 .. _Row_{N-1} secuencialmente y esperar a que termine ExecuteUnityScriptAction (operationID: 127)
            for (let i = 0; i < copyEmailsList.length; i++) {
                const ccItem = copyEmailsList[i];
                const nameVal = (ccItem.name || ccItem.email.split('@')[0] || 'Destinatario CC').trim().slice(0, 60);
                const emailVal = ccItem.email.trim().slice(0, 200);

                await formFrame.evaluate((idx, nVal, eVal, helperStr) => {
                    eval(helperStr);
                    const nameInp = document.getElementById(`destinatarioexternocopia55_input_Row_${idx}`);
                    const emailInp = document.getElementById(`mailcc_input_Row_${idx}`);
                    if (nameInp) setNativeValue(nameInp, nVal);
                    if (emailInp) setNativeValue(emailInp, eVal);
                }, i, nameVal, emailVal, locatorScript).catch(() => {});

                // Esperar a que OnBase termine la validación UnityScript (window.form.executeCount === 0) de esta fila CC
                for (let w = 0; w < 18; w++) {
                    await wait(150);
                    const busy = await formFrame.evaluate(() => {
                        return Boolean(window.form && typeof window.form.isExecuting === 'function' && window.form.isExecuting());
                    }).catch(() => false);
                    if (!busy) break;
                }
            }

            logs.push(`[PASO 4] ✅ 7/8 ${copyEmailsList.length} Copia(s) Externa(s) registradas y validadas en OnBase.`);
        } catch (e) {
            logs.push(`[PASO 4][WARN] Advertencia diligenciando CC: ${e.message}`);
        }
    }

    // Esperar a que cualquier acción asíncrona de Unity Form (executeCount > 0) termine por completo
    for (let w = 0; w < 25; w++) {
        const execState = await formFrame.evaluate(() => {
            const f = window.form;
            const submitDiv = document.getElementById('submitbutton');
            return {
                executing: Boolean(f && typeof f.isExecuting === 'function' && f.isExecuting()),
                executeCount: f ? f.executeCount : 0,
                submitDisabled: submitDiv ? submitDiv.classList.contains('ui-button-disabled') : false
            };
        }).catch(() => ({ executing: false, executeCount: 0, submitDisabled: false }));
        if (!execState.executing && !execState.submitDisabled) break;
        await wait(200);
    }

    // Verificación pre-envío: asegurar que ningún campo haya quedado con invalid_field y que #submitbutton esté habilitado
    const preSubmitCheck = await formFrame.evaluate(() => {
        const asuntoDiv = document.getElementById('asunto27');
        const submitDiv = document.getElementById('submitbutton');
        return {
            asuntoInvalid: asuntoDiv ? asuntoDiv.classList.contains('invalid_field') : false,
            submitDisabled: submitDiv ? submitDiv.classList.contains('ui-button-disabled') : false
        };
    }).catch(() => ({ asuntoInvalid: false, submitDisabled: false }));

    if (preSubmitCheck.asuntoInvalid) {
        await selectAsuntoFromDataSet(asuntoVal);
        await formFrame.evaluate((desc, helperStr) => {
            eval(helperStr);
            const descInp = document.getElementById('descripcionasunto28_input');
            if (descInp && descInp.value !== desc) setNativeValue(descInp, desc);
        }, descAsuntoVal, locatorScript).catch(() => {});
        await wait(350);
    }

    const finalBtnState = await formFrame.evaluate(() => {
        const submitDiv = document.getElementById('submitbutton');
        const asuntoInp = document.getElementById('asunto27_input');
        const descInp = document.getElementById('descripcionasunto28_input');
        const ccValInp = document.getElementById('correocopiavalido_input');
        const destValInp = document.getElementById('correovalido_input');
        const notifItems = Array.from(document.querySelectorAll('.hsi-notificationbaritem, .invalid_field label'))
            .map(el => (el.innerText || el.textContent || '').trim())
            .filter(Boolean);
        return {
            disabled: submitDiv ? submitDiv.classList.contains('ui-button-disabled') : false,
            executeCount: window.form ? window.form.executeCount : 0,
            correovalido: destValInp ? destValInp.value : '',
            correocopiavalido: ccValInp ? ccValInp.value : '',
            asuntoVal: asuntoInp ? asuntoInp.value : '',
            descVal: descInp ? descInp.value : '',
            notifItems
        };
    }).catch(() => ({ disabled: false, executeCount: 0, correovalido: '', correocopiavalido: '', asuntoVal: '', descVal: '', notifItems: [] }));

    if (!finalBtnState.disabled && finalBtnState.notifItems.length === 0) {
        logs.push('[PASO 4] ✅ Verificación OnBase exitosa: Botón "Enviar" HABILITADO (executeCount=0) y 0 errores de validación.');
    } else {
        logs.push(`[PASO 4][WARN] Estado validación OnBase: EnviarDeshabilitado=${finalBtnState.disabled} | executeCount=${finalBtnState.executeCount} | correovalido=${finalBtnState.correovalido} | correocopiavalido=${finalBtnState.correocopiavalido} | Alertas=${finalBtnState.notifItems.join(' | ')}`);
    }

    // Modo Inspección (Sin Enviar): NO marcar como Cargado ni cerrar navegador
    if (opts.solo_diligenciar) {
        logs.push('[PASO 4] 👁️ Modo "Diligenciar (Sin Enviar)": formulario listo en pantalla para inspección visual.');
        return { sent: false, inspectionOnly: true, nis: null, radicado: null, descAsuntoUsed: descAsuntoVal };
    }

    // 8. Clic en botón "Enviar" + Verificación real de radicación en OnBase (#noradicadoproducida16_input / #nis17_input / #panelRadicado)
    recentDialogs = [];
    if (finalBtnState.disabled) {
        throw new Error(`El botón "Enviar" de OnBase permanece deshabilitado por validación del formulario: ${finalBtnState.notifItems.join(' | ') || 'Revise Asunto / Correos'}`);
    }

    logs.push('[PASO 4] 8/8 Presionando botón "Enviar" en OnBase Web...');
    await wait(250);

    let sent = false;
    const sendHandle = await formFrame.$('#submitbutton input[type="submit"], input[type="submit"][value="Enviar"], input[value="Enviar"]').catch(() => null);
    if (sendHandle) {
        await sendHandle.scrollIntoView({ block: 'center' }).catch(() => {});
        await sendHandle.click().catch(() => {});
        sent = true;
    }

    // Asegurar que el motor nativo de Unity Forms (window.form.onSubmit / window.storeFormData) haya iniciado el envío
    await wait(200);
    const nativeSubmitTriggered = await formFrame.evaluate(() => {
        const sendBtn = document.querySelector('#submitbutton input[type="submit"], input[type="submit"][value="Enviar"]');
        if (window.form && !window.form.submitting) {
            if (sendBtn) {
                try { sendBtn.click(); } catch (e) {}
            }
            if (!window.form.submitting) {
                if (typeof window.storeFormData === 'function') {
                    window.storeFormData();
                } else if (typeof window.form.onSubmit === 'function') {
                    window.form.onSubmit(null);
                }
            }
        }
        return Boolean((window.form && window.form.submitting) || sendBtn);
    }).catch(() => true);

    if (!sent && !nativeSubmitTriggered) {
        throw new Error('No se encontró el botón "Enviar" en el formulario UForm Comunicación Electrónica.');
    }

    // Esperar procesamiento real del envío por OnBase y capturar confirmación / NIS (#nis17_input) / Radicado (#noradicadoproducida16_input)
    let capturedRadicado = null;
    let capturedNis = null;
    let formSubmittedConfirmed = false;

    const extractIdentifiers = (txt) => {
        if (!txt) return;
        const radMatch = txt.match(/(?:radicado|comunicaci[oó]n\s+no\.?|n[uú]mero\s+de\s+radicado)[:\s#No.-]*([0-9]{1,4}-[0-9]{1,4}-[0-9]{4}-[0-9]{4,10}|[0-9]{1,4}-[0-9]{4}-[0-9]{4,10}|[0-9]{6,15})/i);
        if (radMatch && radMatch[1] && !capturedRadicado) capturedRadicado = radMatch[1].trim();
        const nisMatch = txt.match(/(?:nis|handle|id\s+documento)[:\s#No.-]*([0-9]{4}-[0-9]{2}-[0-9]{4,10}|[0-9]{5,15})/i);
        if (nisMatch && nisMatch[1] && !capturedNis) capturedNis = nisMatch[1].trim();
    };

    for (let poll = 0; poll < 24; poll++) {
        await wait(500);

        for (const dlgMsg of recentDialogs) {
            extractIdentifiers(dlgMsg);
            const low = dlgMsg.toLowerCase();
            if (low.includes('obligatorio') || low.includes('required') || low.includes('invalid') || low.includes('inválid') || low.includes('error')) {
                throw new Error(`Alerta de validación de OnBase al enviar: "${dlgMsg}"`);
            }
            if (low.includes('enviad') || low.includes('exitos') || low.includes('submitted') || low.includes('saved') || low.includes('radicad')) {
                formSubmittedConfirmed = true;
            }
        }

        if (formFrame.isDetached?.()) {
            formSubmittedConfirmed = true;
            break;
        }

        const postState = await formFrame.evaluate((expectedEmail) => {
            const bodyTxt = document.body ? (document.body.innerText || '') : '';
            const low = bodyTxt.toLowerCase();

            const radInp = document.getElementById('noradicadoproducida16_input');
            const nisInp = document.getElementById('nis17_input');
            const footerDiv = document.getElementById('footer');
            const formEl = document.getElementById('form');

            const radVal = radInp ? (radInp.value || '').trim() : '';
            const nisVal = nisInp ? (nisInp.value || '').trim() : '';
            const footerHidden = footerDiv ? (footerDiv.style.display === 'none' || footerDiv.classList.contains('customaction_hidden') || footerDiv.offsetParent === null) : false;
            const formReadOnly = formEl ? formEl.classList.contains('readonly') : false;

            const errEls = Array.from(document.querySelectorAll('.hsi-notificationbaritem, .validation-summary-errors, .field-validation-error, .error-message'))
                .filter(el => el.offsetParent !== null && (el.innerText || '').trim().length > 0)
                .map(el => (el.innerText || '').trim());

            const emailInp = document.getElementById('mailto_input');
            const currentEmail = emailInp ? (emailInp.value || '').trim() : null;
            const formClearedOrClosed = Boolean(
                radVal ||
                nisVal ||
                footerHidden ||
                formReadOnly ||
                !emailInp ||
                currentEmail === '' ||
                low.includes('nothing to display') ||
                low.includes('form submitted') ||
                low.includes('enviado correctamente') ||
                low.includes('guardado exitosamente')
            );

            return {
                radVal,
                nisVal,
                footerHidden,
                formReadOnly,
                bodySnippet: bodyTxt.substring(0, 1500),
                validationErrors: errEls,
                formClearedOrClosed
            };
        }, emailAprendiz).catch(() => ({ formClearedOrClosed: true, validationErrors: [], bodySnippet: '', radVal: '', nisVal: '' }));

        if (postState.radVal && !capturedRadicado) capturedRadicado = postState.radVal;
        if (postState.nisVal && !capturedNis) capturedNis = postState.nisVal;
        extractIdentifiers(postState.bodySnippet);

        if (postState.validationErrors && postState.validationErrors.length > 0 && !postState.formClearedOrClosed) {
            throw new Error(`Error de validación en formulario OnBase: ${postState.validationErrors.join(' | ')}`);
        }

        if (postState.formClearedOrClosed) {
            formSubmittedConfirmed = true;
            break;
        }
    }

    const mainPageSnippet = await safeEval(page, () => document.body ? (document.body.innerText || '').substring(0, 1500) : '');
    extractIdentifiers(mainPageSnippet);

    if (!formSubmittedConfirmed) {
        throw new Error('OnBase no confirmó el envío del formulario tras presionar "Enviar" (el formulario permaneció abierto sin generar radicado).');
    }

    logs.push(
        `[PASO 4] ✅ 8/8 Comunicación enviada y confirmada por OnBase` +
        `${capturedRadicado ? ` | Radicado: ${capturedRadicado}` : ''}` +
        `${capturedNis ? ` | NIS: ${capturedNis}` : ''}.`
    );

    return {
        sent: true,
        inspectionOnly: false,
        nis: capturedNis,
        radicado: capturedRadicado,
        descAsuntoUsed: descAsuntoVal
    };
}

// ─────────────────────────────────────────────────────────────────
// PASO 7: LOGOUT LIMPIO DE ONBASE WEB AL FINALIZAR LOTE
// ─────────────────────────────────────────────────────────────────
async function paso7_logout(page, logs) {
    if (!page || page.isClosed?.()) return;
    logs.push('[LOGOUT] Cerrando sesión de OnBase Web para liberar licencia del usuario...');
    let logoutClicked = false;
    const allFramesFn = () => {
        try { return page.frames(); } catch { return []; }
    };

    for (let attempt = 0; attempt < 4 && !logoutClicked; attempt++) {
        await wait(700);
        for (const frame of allFramesFn()) {
            try {
                logoutClicked = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('a, button, span, div, li, td, [role="button"], [role="menuitem"]'));
                    const logoutWords = ['cerrar sesión', 'cerrar sesion', 'log out', 'logout', 'salir', 'exit'];
                    const logoutBtn = elements.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        return logoutWords.some(w => t === w || t.includes(w)) && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                    });
                    if (logoutBtn) {
                        logoutBtn.click();
                        return true;
                    }
                    return false;
                });
                if (logoutClicked) break;
            } catch (e) {}
        }

        if (!logoutClicked) {
            for (const frame of allFramesFn()) {
                try {
                    await frame.evaluate(() => {
                        const userMenu = Array.from(document.querySelectorAll('a, div, span, button, [class*="user" i]')).find(el => {
                            const idCls = `${el.id || ''} ${el.className || ''}`.toLowerCase();
                            return (idCls.includes('user') || idCls.includes('profile')) && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                        });
                        if (userMenu) userMenu.click();
                    });
                } catch (e) {}
            }
        }
    }

    if (!logoutClicked) {
        try {
            const baseUrl = page.url().split('/AppNet/')[0];
            if (baseUrl && baseUrl.startsWith('http')) {
                await page.goto(`${baseUrl}/AppNet/Login.aspx?logout=true`, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
            }
        } catch (e) {}
    }

    await wait(1200);
    logs.push('[LOGOUT] ✅ Sesión OnBase cerrada correctamente.');
}

// ─────────────────────────────────────────────────────────────────
// ENDPOINTS DE ESTADO, FRAME EN VIVO Y STOP/KILL INDEPENDIENTES
// ─────────────────────────────────────────────────────────────────
exports.getDesercionesBotStatus = async (req, res) => {
    try {
        return res.json({
            success: true,
            running: desercionesJob.running,
            jobId: desercionesJob.jobId,
            currentStep: desercionesJob.currentStep,
            logs: (desercionesJob.logs || []).slice(-140),
            error: desercionesJob.error,
            completed: desercionesJob.completed,
            activeUser: desercionesJob.activeUser,
            totalCasos: desercionesJob.totalCasos,
            processedCasos: desercionesJob.processedCasos,
            successCasos: desercionesJob.successCasos,
            errorCasos: desercionesJob.errorCasos,
            currentCasoId: desercionesJob.currentCasoId,
            inspectionMode: desercionesJob.inspectionMode,
            hasBrowserOpen: Boolean(desercionesBrowser),
            hasFrame: Boolean(desercionesJob.liveBuffer || desercionesJob.liveFrame || desercionesJob.screenshot)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getDesercionesBotFrame = async (req, res) => {
    try {
        if (desercionesJob.liveBuffer) {
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': desercionesJob.liveBuffer.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            return res.end(desercionesJob.liveBuffer);
        }
        const rawB64 = desercionesJob.liveFrame || desercionesJob.screenshot;
        if (!rawB64) {
            return res.status(404).send('No frame');
        }
        const b64Data = rawB64.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(b64Data, 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': imgBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        return res.end(imgBuffer);
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

exports.killDesercionesBot = async (req, res) => {
    try {
        stopRequested = true;
        desercionesJob.running = false;
        desercionesJob.inspectionMode = false;

        if (desercionesPage && !desercionesPage.isClosed?.()) {
            await paso7_logout(desercionesPage, desercionesJob.logs).catch(() => {});
        }
        if (desercionesBrowser) {
            await desercionesBrowser.close().catch(() => {});
            desercionesBrowser = null;
            desercionesPage = null;
        }

        desercionesJob.completed = true;
        desercionesJob.currentStep = 'Detenido por el usuario';
        desercionesJob.liveFrame = null;
        desercionesJob.liveBuffer = null;
        desercionesJob.screenshot = null;
        desercionesJob.logs.push('[DETENIDO] 🛑 Robot independiente de Deserciones detenido y navegador cerrado limpiamente.');
        desercionesEmitter.emit('done', desercionesJob);

        return res.json({
            success: true,
            message: 'Robot de Deserciones detenido y sesión cerrada (sin afectar Cargue AES).'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Controles opcionales de soporte manual sobre la sesión activa de Deserciones
exports.clickDesercionesPage = async (req, res) => {
    const { x, y, clickCount = 1, button = 'left' } = req.body || {};
    if (!desercionesPage) return res.status(400).json({ error: 'No hay sesión activa del Robot de Deserciones.' });
    try {
        await desercionesPage.mouse.move(Number(x), Number(y));
        await wait(40);
        await desercionesPage.mouse.click(Number(x), Number(y), { clickCount: Number(clickCount), delay: 60, button });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// EJECUCIÓN PRINCIPAL DEL ROBOT INDEPENDIENTE DE DESERCIONES
// ─────────────────────────────────────────────────────────────────
exports.executeDesercionesBot = async (req, res) => {
    try {
        const {
            url = 'https://onbase.sena.edu.co/AppNet/NavPanel.aspx',
            username,
            password,
            target_user,
            use_custom_password = false,
            stop_at_step,
            solo_diligenciar = false,
            caso_ids,
            retry_errors = false,
            force_restart = false
        } = req.body || {};

        // 1. Proteger si el propio Robot de Deserciones ya está ejecutando un lote (NUNCA interfiere con Cargue AES)
        if (desercionesJob.running) {
            if (!force_restart) {
                return res.status(409).json({
                    error: 'El Robot de Deserciones ya tiene un proceso en ejecución. Presione "Detener" primero o espere a que finalice el lote actual.'
                });
            }
            stopRequested = true;
            if (desercionesBrowser) {
                await desercionesBrowser.close().catch(() => {});
                desercionesBrowser = null;
                desercionesPage = null;
            }
            desercionesJob.running = false;
            await wait(400);
        } else if (desercionesBrowser) {
            // Si había quedado abierto en modo inspección (Paso 3 / Diligenciar sin enviar), cerrarlo antes de iniciar uno nuevo
            await desercionesBrowser.close().catch(() => {});
            desercionesBrowser = null;
            desercionesPage = null;
        }

        // 2. Cargar casos reales desde PostgreSQL (SIN casos ficticios quemados)
        let casosToLoad = [];
        const isStep3Only = Number(stop_at_step) === 3;

        if (!isStep3Only) {
            if (Array.isArray(caso_ids) && caso_ids.length > 0) {
                const validIds = caso_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
                if (validIds.length > 0) {
                    const qRes = await pool.query(
                        `SELECT * FROM deserciones_casos WHERE id = ANY($1::int[]) ORDER BY id ASC`,
                        [validIds]
                    );
                    casosToLoad = qRes.rows || [];
                }
            } else if (retry_errors) {
                const qRes = await pool.query(
                    `SELECT * FROM deserciones_casos WHERE status = 'Error' ORDER BY id ASC LIMIT 100`
                );
                casosToLoad = qRes.rows || [];
            } else {
                const qRes = await pool.query(
                    `SELECT * FROM deserciones_casos WHERE status = 'Pendiente' ORDER BY id ASC LIMIT 100`
                );
                casosToLoad = qRes.rows || [];
            }

            if (casosToLoad.length === 0) {
                return res.status(400).json({
                    error: retry_errors
                        ? 'No hay casos en estado "Error" pendientes por reintentar.'
                        : 'No hay casos pendientes por cargar en la base de datos. Guarde primero las comunicaciones o seleccione los registros en la tabla.'
                });
            }
        }

        // 3. Resolver credenciales oficiales desde organization_structure
        const effectiveTargetUser = target_user || casosToLoad[0]?.onbase_target_user || 'EDHERNANDEZM';
        const creds = await resolveBotCredentials({ username, password, target_user: effectiveTargetUser, use_custom_password });
        if (!creds.username || !creds.password) {
            return res.status(400).json({ error: 'No se encontraron credenciales válidas de OnBase para ejecutar el Robot de Deserciones.' });
        }

        stopRequested = false;
        const jobId = `des-${Date.now()}`;
        const logs = [
            `[BOT DESERCIONES] 🚀 Motor independiente iniciado (Job ${jobId} — aislado 100% de Cargue AES).`,
            `[CONFIG] 🔑 Cuenta OnBase: "${creds.username}" | Origen: ${creds.source}`,
            isStep3Only
                ? `[CONFIG] 🎯 Modo apertura de formulario en blanco (hasta Paso 3).`
                : `[CONFIG] 📋 Casos en cola: ${casosToLoad.length}${solo_diligenciar ? ' (Modo Inspección: Diligenciar SIN Enviar)' : ''}`
        ];

        desercionesJob = {
            running: true,
            jobId,
            currentStep: `PASO 1: Login (${creds.username})`,
            logs,
            error: null,
            completed: false,
            screenshot: null,
            liveFrame: null,
            liveBuffer: null,
            startTime: new Date().toISOString(),
            activeUser: creds.username,
            totalCasos: casosToLoad.length,
            processedCasos: 0,
            successCasos: 0,
            errorCasos: 0,
            currentCasoId: null,
            inspectionMode: Boolean(isStep3Only || solo_diligenciar)
        };

        res.json({
            success: true,
            jobId,
            activeUser: creds.username,
            totalCasos: casosToLoad.length,
            message: isStep3Only
                ? 'Robot independiente de Deserciones abriendo formulario hasta Paso 3...'
                : `Robot independiente de Deserciones iniciado para ${casosToLoad.length} caso(s).`,
            logs: desercionesJob.logs
        });

        // 4. Ejecución asíncrona en segundo plano con su propio navegador Puppeteer
        (async () => {
            let keepOpenForInspection = false;
            try {
                desercionesBrowser = await puppeteer.launch({
                    headless: process.platform === 'linux' ? true : false,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });
                const browser = desercionesBrowser;

                browser.on('targetcreated', async target => {
                    if (target.type() === 'page') {
                        const newPage = await target.page().catch(() => null);
                        if (newPage) {
                            newPage.on('dialog', async dialog => {
                                const msg = dialog.message();
                                recentDialogs.push(msg);
                                desercionesJob.logs.push(`[DIALOG] 💬 "${msg}" (${dialog.type()}) -> Aceptado.`);
                                await dialog.accept().catch(() => {});
                            });
                        }
                    }
                });

                desercionesPage = await browser.newPage();
                const page = desercionesPage;
                await page.setViewport({ width: 1366, height: 900 });

                page.on('dialog', async dialog => {
                    const msg = dialog.message();
                    recentDialogs.push(msg);
                    desercionesJob.logs.push(`[DIALOG] 💬 "${msg}" (${dialog.type()}) -> Aceptado.`);
                    await dialog.accept().catch(() => {});
                });

                // Screencast dedicado exclusivamente al monitor de Deserciones
                try {
                    const session = await page.target().createCDPSession();
                    await session.send('Page.startScreencast', {
                        format: 'jpeg',
                        quality: 35,
                        maxWidth: 850,
                        maxHeight: 530,
                        everyNthFrame: 8
                    });
                    let lastFrameTime = 0;
                    session.on('Page.screencastFrame', ev => {
                        const now = Date.now();
                        if (now - lastFrameTime >= 800) {
                            lastFrameTime = now;
                            desercionesJob.liveBuffer = Buffer.from(ev.data, 'base64');
                            desercionesJob.liveFrame = 'data:image/jpeg;base64,' + ev.data;
                        }
                        session.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
                    });
                } catch (e) {}

                // PASO 1: Login
                const loginOk = await paso1_login(page, url, creds.username, creds.password, desercionesJob.logs);
                if (!loginOk) {
                    const ss = await page.screenshot().catch(() => null);
                    desercionesJob.screenshot = ss ? `data:image/png;base64,${ss.toString('base64')}` : null;
                    throw new Error(`Autenticación fallida en OnBase con el usuario "${creds.username}". Verifique las credenciales.`);
                }

                if (stopRequested || !desercionesJob.running) return;

                // PASO 2 -> PASO 3: Abrir UForm Comunicación Electrónica
                desercionesJob.currentStep = 'PASO 3: Apertura de UForm Comunicación Electrónica';
                let activeFormFrame = await paso3_uformComunicacionElectronica(page, browser, desercionesJob.logs);

                if (isStep3Only) {
                    keepOpenForInspection = true;
                    const ss = await page.screenshot({ type: 'jpeg', quality: 55 }).catch(() => null);
                    if (ss) desercionesJob.liveBuffer = ss;
                    desercionesJob.logs.push('[PASO 3] ✅ Formulario en blanco abierto en pantalla. Presione "Detener" cuando termine de inspeccionar.');
                    desercionesJob.running = false;
                    desercionesJob.completed = true;
                    desercionesEmitter.emit('done', desercionesJob);
                    return;
                }

                // PASO 4: Procesar lote de casos
                for (let cIdx = 0; cIdx < casosToLoad.length; cIdx++) {
                    if (stopRequested || !desercionesJob.running) {
                        desercionesJob.logs.push('[DETENIDO] Lote interrumpido por solicitud del usuario.');
                        break;
                    }

                    const casoItem = casosToLoad[cIdx];
                    desercionesJob.currentCasoId = casoItem.id;
                    desercionesJob.currentStep = `[Caso ${cIdx + 1}/${casosToLoad.length}] PASO 4: ${casoItem.aprendiz_nombre}`;
                    desercionesJob.logs.push(`\n──────────────────────────────────────────────────`);
                    desercionesJob.logs.push(`[Caso ${cIdx + 1}/${casosToLoad.length}] #${casoItem.id} — ${casoItem.aprendiz_nombre} (${casoItem.aprendiz_doc_tipo || 'CC'} ${casoItem.aprendiz_doc_numero || 'S/N'})`);

                    const maxAttempts = solo_diligenciar ? 1 : 2;
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        try {
                            if (cIdx > 0 || attempt > 1) {
                                activeFormFrame = await paso3_uformComunicacionElectronica(page, browser, desercionesJob.logs);
                                await wait(400);
                            }

                            const sendResult = await paso4_diligenciarComunicacionElectronica(
                                page,
                                browser,
                                casoItem,
                                desercionesJob.logs,
                                { solo_diligenciar: Boolean(solo_diligenciar), formFrame: activeFormFrame }
                            );

                            if (sendResult.inspectionOnly) {
                                keepOpenForInspection = true;
                                const ss = await page.screenshot({ type: 'jpeg', quality: 55 }).catch(() => null);
                                if (ss) desercionesJob.liveBuffer = ss;
                                desercionesJob.processedCasos++;
                                desercionesJob.logs.push(`[Caso #${casoItem.id}] 👁️ Formulario diligenciado SIN enviar (el estado en BD se conserva como "${casoItem.status}").`);
                            } else {
                                await pool.query(
                                    `UPDATE deserciones_casos
                                     SET status = 'Cargado',
                                         nis = COALESCE($2, nis),
                                         radicado = COALESCE($3, radicado),
                                         descripcion_asunto = $4,
                                         onbase_target_user = $5,
                                         error_message = NULL,
                                         error_screenshot = NULL,
                                         enviado_at = CURRENT_TIMESTAMP,
                                         updated_at = CURRENT_TIMESTAMP
                                     WHERE id = $1`,
                                    [
                                        casoItem.id,
                                        sendResult.nis || null,
                                        sendResult.radicado || null,
                                        sendResult.descAsuntoUsed || casoItem.descripcion_asunto,
                                        creds.username
                                    ]
                                );
                                desercionesJob.processedCasos++;
                                desercionesJob.successCasos++;
                                desercionesJob.logs.push(`[Caso #${casoItem.id}] ✅ Radicado exitosamente y actualizado a "Cargado" en BD.`);
                            }
                            break;
                        } catch (caseErr) {
                            desercionesJob.logs.push(`[Caso #${casoItem.id}] ⚠️ Intento ${attempt}/${maxAttempts} falló: ${caseErr.message}`);
                            await checkAndClearLocks(browser, desercionesJob.logs).catch(() => {});

                            // Si es un error de validación de datos (correo, PDF faltante, variables {{}}), no reintentar en vano en Puppeteer
                            const isDataError = /correo|variables sin combinar|falta el pdf|archivo anexo asignado|vacío/i.test(caseErr.message);

                            if (attempt < maxAttempts && !isDataError && !stopRequested) {
                                desercionesJob.logs.push(`[Caso #${casoItem.id}] 🔄 Reintentando caso en 2 segundos...`);
                                await wait(2000);
                            } else {
                                let errorScreenPath = null;
                                try {
                                    const errDir = path.join(__dirname, '..', 'uploads', 'deserciones', 'errors');
                                    if (!fs.existsSync(errDir)) fs.mkdirSync(errDir, { recursive: true });
                                    const errFileName = `error_caso_${casoItem.id}_${Date.now()}.png`;
                                    const fullErrPath = path.join(errDir, errFileName);
                                    await page.screenshot({ path: fullErrPath, fullPage: false });
                                    errorScreenPath = `/uploads/deserciones/errors/${errFileName}`;
                                    desercionesJob.logs.push(`[Caso #${casoItem.id}] 📸 Evidencia del fallo guardada: ${errFileName}`);
                                } catch (screenErr) {}

                                // Guardar en columnas dedicadas error_message y error_screenshot SIN destruir descripcion_asunto
                                await pool.query(
                                    `UPDATE deserciones_casos
                                     SET status = 'Error',
                                         error_message = $2,
                                         error_screenshot = $3,
                                         updated_at = CURRENT_TIMESTAMP
                                     WHERE id = $1`,
                                    [casoItem.id, caseErr.message, errorScreenPath]
                                ).catch(() => {});

                                desercionesJob.processedCasos++;
                                desercionesJob.errorCasos++;
                                break;
                            }
                        }
                    }

                    if (keepOpenForInspection) break;
                }

                desercionesJob.logs.push(
                    `\n[RESUMEN LOTE] ✅ Finalizado: ${desercionesJob.successCasos} cargado(s), ` +
                    `${desercionesJob.errorCasos} con error, de ${casosToLoad.length} caso(s).`
                );
                desercionesJob.currentStep = 'Proceso finalizado';
            } catch (fatalErr) {
                desercionesJob.error = fatalErr.message;
                desercionesJob.logs.push(`[ERROR CRÍTICO] ❌ ${fatalErr.message}`);
            } finally {
                desercionesJob.running = false;
                desercionesJob.completed = true;
                desercionesJob.currentCasoId = null;

                if (!keepOpenForInspection) {
                    if (desercionesPage && !desercionesPage.isClosed?.()) {
                        await paso7_logout(desercionesPage, desercionesJob.logs).catch(() => {});
                    }
                    if (desercionesBrowser) {
                        await desercionesBrowser.close().catch(() => {});
                        desercionesBrowser = null;
                        desercionesPage = null;
                    }
                }
                desercionesEmitter.emit('done', desercionesJob);
            }
        })();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
