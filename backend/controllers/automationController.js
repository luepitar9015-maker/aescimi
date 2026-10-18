const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const EventEmitter = require('events');
const db = require('../database');
const { pool } = require('../database_pg');

const automationEmitter = new EventEmitter();
automationEmitter.setMaxListeners(20);

const wait = (ms) => new Promise(r => setTimeout(r, ms));

let activeBrowser = null;
let activePage = null;

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

/** Ejecuta fn en frameOrPage sin lanzar error (retorna null si falla) */
const safeEval = async (frameOrPage, fn, ...args) => {
    try { return await frameOrPage.evaluate(fn, ...args); } catch { return null; }
};

/** Busca un frame por URL parcial dentro de una página */
const getFrame = (page, urlPart) =>
    page.frames().find(f => f.url().includes(urlPart)) || null;

/** Escribe texto en un selector con soporte para reintentos si el elemento se desprende del DOM */
const safeType = async (page, selector, text, delay = 50) => {
    for (let i = 0; i < 5; i++) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 8000 });
            if (element) {
                const isAttached = await page.evaluate(el => el.isConnected, element).catch(() => false);
                if (isAttached) {
                    await element.click({ clickCount: 3 }).catch(() => {});
                    await wait(200);
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Delete');
                    await wait(200);
                    await element.type(text, { delay });
                    return true;
                }
            }
        } catch (e) {
            // Silencioso, reintenta
        }
        await wait(800);
    }
    return false;
};

/** Clic en un selector con soporte para reintentos si el elemento se desprende del DOM */
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
        } catch (e) {
            // Silencioso, reintenta
        }
        await wait(800);
    }
    return false;
};

// Helper para detectar y quitar bloqueos de objetos (Locked Objects)
async function checkAndClearLocks(browser, logs) {
    try {
        const allPages = await browser.pages().catch(() => []);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const hasLocksPopup = await frame.evaluate(() => {
                        const txt = document.body ? document.body.innerText.toLowerCase() : '';
                        return (txt.includes('locked objects') || txt.includes('manage locks') || txt.includes('objetos bloqueados')) && txt.includes('lock type');
                    });
                    
                    if (hasLocksPopup) {
                        logs.push('[LOCKS] ⚠️ Detectada advertencia de objetos bloqueados (Locked Objects)');
                        
                        const action = await frame.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                            
                            // 1. Intentar hacer clic en "Select All" o "Seleccionar todo"
                            const selectAllBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('select all') || t.includes('seleccionar todo');
                            });
                            if (selectAllBtn) {
                                selectAllBtn.click();
                                return 'select_all';
                            }
                            
                            // 2. Si no hay select all, buscar Remove Lock / Eliminar bloqueo directamente
                            const removeBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                            });
                            if (removeBtn) {
                                removeBtn.click();
                                return 'remove_lock';
                            }
                            
                            return null;
                        });
                        
                        if (action) {
                            logs.push(`[LOCKS] Acción ejecutada: ${action}`);
                            await wait(2000);
                            
                            if (action === 'select_all') {
                                // Clic en Remove Lock ahora
                                await frame.evaluate(() => {
                                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                                    const removeBtn = buttons.find(b => {
                                        const t = (b.innerText || b.value || '').trim().toLowerCase();
                                        return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                                    });
                                    if (removeBtn) removeBtn.click();
                                });
                                logs.push('[LOCKS] Clic en Remove Lock ejecutado');
                                await wait(3000);
                            }
                            
                            // Cerrar el popup haciendo clic en el botón de cerrar
                            await frame.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div, img'));
                                const closeBtn = buttons.find(b => {
                                    const t = (b.innerText || b.value || '').trim().toLowerCase();
                                    return t === 'x' || t === 'close' || t === 'cerrar' || t === 'cancel' || t === 'cancelar' || b.className?.includes('close') || b.id?.includes('close');
                                });
                                if (closeBtn) closeBtn.click();
                            });
                            logs.push('[LOCKS] Popup de bloqueo cerrado');
                            await wait(2000);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (err) {}
}

// ─────────────────────────────────────────────────────────────────
// PASO 1: LOGIN
// ─────────────────────────────────────────────────────────────────
async function paso1_login(page, url, username, password, logs) {
    logs.push('[PASO 1] Navegando a OnBase...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        .catch(e => logs.push(`[PASO 1][WARN] goto: ${e.message}`));
    await wait(3000);

    // Detectar si estamos en Microsoft SSO
    let isMicrosoftSSO = false;
    for (let i = 0; i < 5; i++) {
        try {
            isMicrosoftSSO = page.url().includes('microsoftonline.com') || await page.evaluate(() => {
                return window.location.href.includes('microsoftonline.com') || 
                       document.title.includes('Iniciar sesión') || 
                       document.title.includes('Sign in') || 
                       !!document.querySelector('input[name="loginfmt"]');
            });
            break;
        } catch (e) {
            logs.push(`[PASO 1][WARN] Esperando estabilidad de la página para SSO (intento ${i+1}): ${e.message}`);
            await wait(2000);
        }
    }

    if (isMicrosoftSSO) {
        logs.push('[PASO 1] Detectado inicio de sesión de Microsoft (SSO)');
        
        let effectiveUsername = username;
        if (!username.includes('@')) {
            effectiveUsername = `${username}@sena.edu.co`;
            logs.push(`[PASO 1] Nombre de usuario sin dominio en SSO. Auto-ajustado a: ${effectiveUsername}`);
        }

        // 1. Escribir usuario/correo
        logs.push('[PASO 1] Buscando campo de correo de Microsoft...');
        const emailOk = await safeType(page, 'input[type="email"], input[name="loginfmt"], #i0116', effectiveUsername, 60);
        if (!emailOk) {
            logs.push('[PASO 1][ERROR] Campo de correo de Microsoft no encontrado o no interactuable');
            return false;
        }
        logs.push('[PASO 1] Correo escrito');
        
        // Clic en Siguiente
        logs.push('[PASO 1] Clic en "Siguiente" de Microsoft...');
        const nextOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!nextOk) {
            logs.push('[PASO 1][ERROR] Botón "Siguiente" de Microsoft no encontrado');
            return false;
        }
        await wait(2000); // esperar animación de transición
        
        // 2. Esperar y escribir contraseña
        logs.push('[PASO 1] Buscando campo de contraseña de Microsoft...');
        const passOk = await safeType(page, 'input[type="password"], input[name="passwd"], #i0118', password, 60);
        if (!passOk) {
            const errMsg = await page.evaluate(() => {
                const el = document.querySelector('#usernameError, #error, .error');
                return el ? el.innerText.trim() : null;
            }).catch(() => null);
            logs.push(`[PASO 1][ERROR] Campo de contraseña de Microsoft no encontrado. Error en página: ${errMsg || 'Ninguno'}`);
            return false;
        }
        logs.push('[PASO 1] Contraseña escrita');
        
        // Clic en Iniciar sesión
        logs.push('[PASO 1] Clic en "Iniciar Sesión" (Microsoft)...');
        const submitOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!submitOk) {
            logs.push('[PASO 1][ERROR] Botón de envío de Microsoft no encontrado');
            return false;
        }
        
        // Esperar respuesta de Microsoft
        await wait(5000);
        
        // 3. Comprobar si hay pantalla "¿Quiere mantener la sesión iniciada?"
        let staySignedIn = false;
        for (let i = 0; i < 5; i++) {
            try {
                staySignedIn = await page.evaluate(() => {
                    const hasStayText = document.body ? (document.body.innerText.includes('mantener la sesión') || 
                                        document.body.innerText.includes('Stay signed in')) : false;
                    const hasNoBtn = !!document.querySelector('#idBtn_Back');
                    return hasStayText && hasNoBtn;
                });
                break;
            } catch (e) {
                logs.push(`[PASO 1][WARN] Esperando estabilidad de la página para mantener sesión (intento ${i+1}): ${e.message}`);
                await wait(2000);
            }
        }
        
        if (staySignedIn) {
            logs.push('[PASO 1] Detectada pantalla "Mantener sesión iniciada". Clic en "No"...');
            const noBtn = await page.$('#idBtn_Back');
            if (noBtn) {
                await noBtn.click();
            } else {
                const yesBtn = await page.$('#idSIButton9');
                if (yesBtn) await yesBtn.click();
            }
            await wait(5000);
        }

    } else {
        logs.push('[PASO 1] Detectado formulario de login OnBase estándar');
        
        // Esperar campo de usuario
        const userOk = await safeType(page, '#username, input[type="text"], input[name="username"]', username, 60);
        if (!userOk) {
            logs.push('[PASO 1][ERROR] Campo de usuario no encontrado');
            return false;
        }
        logs.push('[PASO 1] Usuario escrito');

        // Campo contraseña
        const passOk = await safeType(page, '#password, input[type="password"]', password, 60);
        if (!passOk) {
            logs.push('[PASO 1][ERROR] Campo de contraseña no encontrado');
            return false;
        }
        logs.push('[PASO 1] Contraseña escrita');

        // Botón login
        const loginBtn = await page.$('#loginButton, button[type="submit"], input[type="submit"]');
        if (loginBtn) {
            await loginBtn.click();
        } else {
            await page.keyboard.press('Enter');
        }
        logs.push('[PASO 1] Botón login presionado. Esperando navegación...');
    }

    // Esperar 4 segundos y revisar si hay pantalla de "Sesión ya iniciada/Takeover"
    await wait(4000);
    let sessionTakeover = false;
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
        sessionTakeover = true;
        logs.push('[PASO 1] ⚠️ Detectada advertencia de sesión activa. Tomando control de la sesión (Session Takeover)...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 25000 }).catch(() => {}),
            page.click(takeoverButtonSelector)
        ]);
        await wait(6000); // Tiempo adicional para inicialización de JS post-takeover
    } else {
        // Esperar navegación normal
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
        await wait(3000);
    }

    const postUrl = page.url();
    logs.push(`[PASO 1] URL post-login: ${postUrl}`);

    if (postUrl.includes('NavPanel') || postUrl.includes('Dashboard') || postUrl.includes('Home') || postUrl.toLowerCase().includes('document/query')) {
        logs.push('[PASO 1] ✅ Login exitoso');
        await checkAndClearLocks(page.browser(), logs).catch(() => {});
        return true;
    }

    // Revisar si hay mensaje de error en la página actual
    const errMsg = await safeEval(page, () => {
        const el = document.querySelector('#ErrorMessage, .error-message, [class*="error"], #error-information, .error');
        return el ? el.innerText.trim() : null;
    });
    logs.push(`[PASO 1][ERROR] Login falló. Error: ${errMsg || 'Usuario/Contraseña incorrectos o requiere verificación manual (MFA)'}`);
    return false;
}

// ─────────────────────────────────────────────────────────────────
// PASO 2: ABRIR FORMULARIO SGDEA
// Navegación real confirmada en video:
//   sidebar izq → "Nuevo formulario" → seleccionar SGDEA de la lista
// ─────────────────────────────────────────────────────────────────
async function paso2_abrirFormulario(page, browser, logs) {
    // 0. Verificar si el formulario SGDEA ya está abierto (ej. tras "Guardar -> Sí")
    let alreadyOpen = false;
    try {
        const allPagesCheck = await browser.pages().catch(() => [page]);
        for (const pg of allPagesCheck) {
            for (const frame of pg.frames()) {
                try {
                    const found = await frame.evaluate(() => {
                        const html = document.body ? document.body.innerHTML.toLowerCase() : '';
                        return (html.includes('código expediente') || html.includes('codigo expediente')) && html.includes('nombre documento');
                    });
                    if (found) { alreadyOpen = true; break; }
                } catch { }
            }
            if (alreadyOpen) break;
        }
    } catch { }

    if (alreadyOpen) {
        logs.push('[PASO 2] ✅ Formulario SGDEA ya se encuentra abierto en pantalla');
        return true;
    }

    logs.push('[PASO 2] Buscando "Nuevo formulario" en el sidebar de OnBase...');

    // Esperar que el NavPanel cargue
    await wait(3000);

    // Estrategia 1: clic directo en el link "Nuevo formulario" del sidebar
    const clickedNewForm = await page.evaluate(() => {
        // Buscar en todos los links del sidebar
        const allLinks = Array.from(document.querySelectorAll('a, li, span, div'));
        const link = allLinks.find(el => {
            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
            return t === 'nuevo formulario' || t === 'new form';
        });
        if (link) {
            link.scrollIntoView({ block: 'center' });
            link.click();
            return link.innerText || link.textContent || 'clicked';
        }
        return null;
    }).catch(() => null);

    if (clickedNewForm) {
        logs.push(`[PASO 2] ✅ "Nuevo formulario" clickeado: "${clickedNewForm.trim()}"`);
    } else {
        logs.push('[PASO 2][WARN] Link "Nuevo formulario" no encontrado en sidebar. Intentando en frames...');
        // Buscar en todos los frames de la página
        for (const frame of page.frames()) {
            try {
                const ok = await frame.evaluate(() => {
                    const allLinks = Array.from(document.querySelectorAll('a, li'));
                    const link = allLinks.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        return t === 'nuevo formulario' || t === 'new form';
                    });
                    if (link) { link.click(); return true; }
                    return false;
                });
                if (ok) { logs.push('[PASO 2] ✅ "Nuevo formulario" clickeado en frame.'); break; }
            } catch { }
        }
    }

    // Esperar que OnBase cargue la lista de tipos de formulario
    logs.push('[PASO 2] Esperando lista de formularios (hasta 12s)...');
    await wait(4000);

    // Buscar SGDEA en la lista que aparece
    // En OnBase el formulario aparece como item en un panel izquierdo o centro
    logs.push('[PASO 2] Buscando "SGDEA" en la lista de formularios...');
    let sgdeaClicked = false;

    for (let intento = 0; intento < 15 && !sgdeaClicked; intento++) {
        await wait(1000);
        const allPages = await browser.pages();

        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const result = await frame.evaluate(() => {
                        // Buscar en listas de items, links, spans con texto SGDEA
                        const candidates = Array.from(document.querySelectorAll(
                            'li, a, span, td, div, [role="treeitem"], [role="listitem"], [role="option"]'
                        ));
                        const matches = candidates.filter(el => {
                            const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                            return (t.includes('SGDEA - INGRESO A EXPEDIENTE') || t === 'SGDEA - INGRESO A EXPEDIENTE') && t.length < 150;
                        });
                        if (matches.length === 0) return null;
                        
                        // Coger el más largo en este caso o el exacto, para evitar la carpeta
                        const target = matches.find(m => (m.innerText || '').trim().toUpperCase() === 'SGDEA - INGRESO A EXPEDIENTE') || matches[0];
                        const text = (target.innerText || target.textContent || '').trim();
                        target.scrollIntoView({ block: 'center' });
                        return text.substring(0, 120);
                    });

                    if (result) {
                        logs.push(`[PASO 2] SGDEA encontrado en intento ${intento + 1}: "${result}"`);

                        // Obtener coordenadas y usar Puppeteer nativo
                        const actionCmd = await frame.evaluate(() => {
                            const candidates = Array.from(document.querySelectorAll('a, span, div, li, [role="treeitem"]'));
                            
                            // Primero buscamos el enlace específico
                            const specific = candidates.filter(el => {
                                const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                                return t === 'SGDEA - INGRESO A EXPEDIENTE' && el.offsetParent !== null;
                            })[0];
                            
                            if (specific) {
                                specific.scrollIntoView({ block: 'center' });
                                const rect = specific.getBoundingClientRect();
                                let nodeForCoords = specific;
                                if (rect.width === 0 && specific.children.length > 0) nodeForCoords = specific.children[0];
                                const finalRect = nodeForCoords.getBoundingClientRect();
                                return { action: 'doubleClickForm', x: finalRect.left + finalRect.width / 2, y: finalRect.top + finalRect.height / 2, html: specific.outerHTML.substring(0, 100) };
                            }
                            
                            // Si no encontramos el específico, buscamos la carpeta para abrirla
                            const folder = candidates
                                .filter(el => (el.innerText || el.textContent || '').trim().toUpperCase() === 'SGDEA' && el.offsetParent !== null)
                                .sort((a,b) => (a.innerText||'').length - (b.innerText||'').length)[0];
                                
                            if (folder) {
                                folder.scrollIntoView({ block: 'center' });
                                const rect = folder.getBoundingClientRect();
                                return { action: 'clickFolder', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, html: folder.outerHTML.substring(0, 100) };
                            }
                            
                            return null;
                        });
                        
                        if (actionCmd) {
                            let fOffsetX = 0, fOffsetY = 0;
                            try {
                                const fEl = await frame.frameElement();
                                const fBox = await fEl.boundingBox();
                                if (fBox) { fOffsetX = fBox.x; fOffsetY = fBox.y; }
                            } catch(e) {}
                            
                            if (actionCmd.action === 'clickFolder') {
                                logs.push(`[PASO 2] Abriendo carpeta SGDEA...`);
                                await pg.mouse.click(fOffsetX + actionCmd.x, fOffsetY + actionCmd.y, { clickCount: 1 });
                                await wait(1500); // Esperar animación
                                continue; // Repetir el loop para que en el próximo intento encuentre el formulario
                            } else if (actionCmd.action === 'doubleClickForm') {
                                logs.push(`[PASO 2] Formulario objetivo detectado: ${actionCmd.html}`);
                                await pg.mouse.click(fOffsetX + actionCmd.x, fOffsetY + actionCmd.y, { clickCount: 2 });
                                logs.push('[PASO 2] ✅ "SGDEA - Ingreso a Expediente" seleccionado con doble clic nativo');
                                sgdeaClicked = true;
                                break;
                            }
                        }
                        
                    }
                } catch { }
            }
            if (sgdeaClicked) break;
        }
    }

    if (!sgdeaClicked) {
        logs.push('[PASO 2][WARN] SGDEA no se pudo seleccionar. Verifique que el tipo de formulario exista.');
    }

    // Esperar que el formulario abra (OnBase puede abrir en nueva pestaña o en iframe)
    logs.push('[PASO 2] Esperando que el formulario SGDEA cargue (max 90s)...');
    
    let formLoaded = false;
    for (let t = 0; t < 180 && !formLoaded; t++) {
        await wait(500);
        await checkAndClearLocks(browser, logs);
        const allPages = await browser.pages();
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const found = await frame.evaluate(() => {
                        const html = document.body ? document.body.innerHTML.toLowerCase() : '';
                        return html.includes('código expediente') || html.includes('codigo expediente') || html.includes('nombre documento');
                    });
                    if (found) { formLoaded = true; break; }
                } catch { }
            }
            if (formLoaded) break;
        }
    }
    
    if (formLoaded) {
        logs.push('[PASO 2] ✅ Formulario cargado (frame detectado)');
        await wait(2000); // 2 segundos adicionales para que terminen de pintar los inputs
    } else {
        logs.push('[PASO 2][WARN] TIMEOUT esperando que el formulario aparezca en el DOM.');
    }
    
    return true;
}

// ─────────────────────────────────────────────────────────────────
// PASO 3: UForm Comunicación Electrónica (Ultra Rápido)
// ─────────────────────────────────────────────────────────────────
async function paso3_uformComunicacionElectronica(page, browser, logs) {
    logs.push('[PASO 3] Buscando "Nuevo formulario" y seleccionando "UForm Comunicación Electrónica"...');
    await wait(200);

    // 0. Redirección relámpago si la interfaz está en "Document Retrieval"
    for (let attempt = 0; attempt < 5; attempt++) {
        const switched = await page.evaluate(() => {
            const txt = document.body ? document.body.innerText.toLowerCase() : '';
            const isDocRetrieval = txt.includes('document retrieval') || txt.includes('document types');
            const isFormOpen = txt.includes('comunicación electrónica') || txt.includes('destinatario externo');

            if (isDocRetrieval && !isFormOpen) {
                // Hacer clic en cualquier icono de Grid / Nuevo Formulario
                const gridBtn = document.querySelector(
                    '#newform, [id*="NewForm" i], [id*="newform" i], [onclick*="NewForm" i], ' +
                    '[title*="Form" i], [title*="formulario" i], [aria-label*="Form" i], ' +
                    'a.navMenu, span.icon-grid, i.fa-th, i.icon-grid, .icon-apps, span.app-icon, ' +
                    'button[title*="New" i], a[title*="New" i]'
                );
                if (gridBtn) {
                    gridBtn.click();
                    return 'Boton Nuevo Formulario (Grid) cliqueado';
                }

                // Buscar por enlaces o botones con texto "Nuevo formulario" o "New Form"
                const allClickables = Array.from(document.querySelectorAll('a, button, span, div, i'));
                const newFormBtn = allClickables.find(el => {
                    const t = (el.title || el.getAttribute('aria-label') || el.innerText || '').toLowerCase();
                    const cls = (el.className || '').toString().toLowerCase();
                    return t.includes('new form') || t.includes('nuevo formulario') || cls.includes('grid') || cls.includes('th');
                });
                if (newFormBtn) {
                    newFormBtn.click();
                    return 'Enlace Nuevo Formulario cliqueado';
                }
            }
            return null;
        }).catch(() => null);

        if (switched) {
            logs.push(`[PASO 3] ✅ Redirección desde Document Retrieval: ${switched}`);
            await wait(500);
            break;
        }
        await wait(200);
    }

    // 1. Doble clic en "UForm Comunicacion Electronica"
    logs.push('[PASO 3] Buscando item "UForm Comunicacion Electronica" en el catálogo de formularios...');
    let itemClicked = false;
    let clickCoords = null;
    let targetPg = page;

    for (let attempt = 0; attempt < 20 && !itemClicked; attempt++) {
        await wait(300);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    // Abrir carpeta si está colapsada
                    await frame.evaluate(() => {
                        const headers = Array.from(document.querySelectorAll('a, li, span, td, div, label'));
                        const header = headers.find(el => (el.innerText || el.textContent || '').trim().toUpperCase() === 'COMUNICACIONES PRODUCIDAS');
                        if (header) {
                            header.click();
                        }
                    }).catch(() => {});

                    const actionRes = await frame.evaluate(() => {
                        // Buscar primero por ID conocido o selector específico
                        const exact = document.querySelector('#itemLabelunity118, #liunity118, [id*="unity118"]');
                        let el = exact;
                        if (!el) {
                            const candidates = Array.from(document.querySelectorAll('a, li, span, td, div, label, [role="treeitem"]'));
                            el = candidates.find(c => {
                                const t = (c.innerText || c.textContent || '').trim().toLowerCase();
                                return (t.includes('uform comunicacion electronica') || 
                                       t.includes('uform comunicación electrónica') ||
                                       t.includes('01-ufrm comunicacion electronica'));
                            });
                        }
                        if (el) {
                            el.scrollIntoView({ block: 'center' });
                            const r = el.getBoundingClientRect();
                            // Disparar eventos nativos de doble clic en JS
                            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                            el.click();
                            return {
                                x: r.left + r.width / 2,
                                y: r.top + r.height / 2,
                                text: el.innerText || el.textContent
                            };
                        }
                        return null;
                    });

                    if (actionRes) {
                        let fOffsetX = 0, fOffsetY = 0;
                        try {
                            const fEl = await frame.frameElement();
                            const fBox = await fEl.boundingBox();
                            if (fBox) { fOffsetX = fBox.x; fOffsetY = fBox.y; }
                        } catch(e) {}

                        // Doble clic nativo con Puppeteer mouse
                        await pg.mouse.click(fOffsetX + actionRes.x, fOffsetY + actionRes.y, { clickCount: 2 });
                        logs.push(`[PASO 3] ✅ Doble clic nativo ejecutado en: "${actionRes.text.trim()}"`);
                        itemClicked = true;
                        clickCoords = { x: fOffsetX + actionRes.x, y: fOffsetY + actionRes.y, pg };
                        targetPg = pg;
                        break;
                    }
                } catch (e) {}
            }
            if (itemClicked) break;
        }
    }

    // 2. Esperar apertura real del formulario (desaparece "Nothing to display" y aparecen inputs)
    logs.push('[PASO 3] Esperando que el formulario "UForm Comunicación Electrónica" cargue en pantalla (max 30s)...');
    let formLoadedFrame = null;

    for (let attempt = 0; attempt < 60 && !formLoadedFrame; attempt++) {
        await wait(500);
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
                                         txt.includes('comunicacion electronica') ||
                                         txt.includes('comunicación electrónica') ||
                                         txt.includes('tipo de destinatario') ||
                                         txt.includes('destinatario externo');
                        return isTarget && hasInputs && isNotNothing;
                    });
                    if (ready) {
                        formLoadedFrame = frame;
                        break;
                    }
                } catch (e) {}
            }
            if (formLoadedFrame) break;
        }

        // Reintentar doble clic a los 4s y 8s si aún sigue en "Nothing to display"
        if ((attempt === 8 || attempt === 16) && !formLoadedFrame && clickCoords) {
            logs.push('[PASO 3] Reintentando doble clic sobre "UForm Comunicación Electrónica"...');
            await clickCoords.pg.mouse.click(clickCoords.x, clickCoords.y, { clickCount: 2 }).catch(() => {});
        }
    }

    if (formLoadedFrame) {
        logs.push('[PASO 3] ✅ Formulario "SENA Comunicación Electrónica" cargado en pantalla con inputs listos.');
    } else {
        logs.push('[PASO 3] Procediendo al diligenciamiento con marcos detectados.');
    }

    // 3. Seleccionar opción "Externo" inmediatamente
    logs.push('[PASO 3] Seleccionando tipo de destinatario: "Externo"...');
    let selectedExterno = false;

    for (let attempt = 0; attempt < 15 && !selectedExterno; attempt++) {
        await wait(150);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const res = await frame.evaluate(() => {
                        // 1. Radio "Externo"
                        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                        const radioExterno = radios.find(r => {
                            const val = (r.value || r.id || r.name || r.title || '').toLowerCase();
                            const nextText = (r.nextSibling?.textContent || r.parentElement?.textContent || '').toLowerCase();
                            return val.includes('externo') || nextText.includes('externo');
                        });

                        if (radioExterno) {
                            radioExterno.scrollIntoView({ block: 'center' });
                            radioExterno.click();
                            radioExterno.checked = true;
                            radioExterno.dispatchEvent(new Event('change', { bubbles: true }));
                            radioExterno.dispatchEvent(new Event('click', { bubbles: true }));
                            return 'Radio "Externo" marcado activamente.';
                        }

                        // 2. Label "Externo"
                        const labels = Array.from(document.querySelectorAll('label, span, font, td, b, strong, div'));
                        const labelExterno = labels.find(el => {
                            const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return txt === 'externo' || txt === 'externo:';
                        });

                        if (labelExterno) {
                            labelExterno.scrollIntoView({ block: 'center' });
                            labelExterno.click();
                            
                            const parent = labelExterno.closest('td, tr, div, p, fieldset') || labelExterno.parentElement;
                            if (parent) {
                                const inputInParent = parent.querySelector('input[type="radio"]');
                                if (inputInParent) {
                                    inputInParent.click();
                                    inputInParent.checked = true;
                                    inputInParent.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                            return 'Label "Externo" cliqueado correctamente.';
                        }

                        return null;
                    });

                    if (res) {
                        selectedExterno = true;
                        logs.push(`[PASO 3] ✅ "Por favor seleccione tipo de destinatario: Externo" seleccionado (${res}).`);
                        break;
                    }
                } catch (e) {}
            }
            if (selectedExterno) break;
        }
    }

    return true;
}


// Helper para resolver rutas locales de anexos PDF sin importar si vienen de Linux o Windows
function resolverRutaLocalPDF(ruta) {
    if (!ruta || typeof ruta !== 'string') return null;
    if (fs.existsSync(ruta)) return ruta;
    
    const filename = path.basename(ruta);
    if (!filename) return null;

    const candidates = [
        path.join(__dirname, '..', 'uploads', 'deserciones', filename),
        path.join(__dirname, '..', 'uploads', 'deserciones_pdf', filename),
        path.join(__dirname, '..', 'uploads', filename),
        path.join(process.cwd(), 'uploads', 'deserciones', filename),
        path.join(process.cwd(), 'uploads', 'deserciones_pdf', filename),
        path.join(process.cwd(), 'uploads', filename)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────
// PASO 4 (DESERCIONES): Diligenciamiento de Formulario "Comunicación Electrónica" en OnBase Web
// 1. Destinatario Externo: Selección de Radio "Externo"
// 2. Nombre Destinatario: Aprendiz (destinatarioexterno24_input)
// 3. Email Destinatario: Correo Registrado en Sofía (mailto_input)
// 4. Asunto: 'NOVEDADES DE ALUMNOS' (asunto27_input + Clic en dropdown de autocompletado)
// 5. Descripción del Asunto: 'Notificación' (descripcionasunto28_input)
// 6. Campo de Texto: Texto completo de la carta combinada (ctxt_cuerpo_input)
// 7. Adjuntar anexo: Resolución / Documento PDF / Anexo explícito
// 8. Copias Externas: Clic en 'Add' e ingresar Nombre y Correo en Copias Externas
// 9. Enviar: Clic en el botón "Enviar"
// ─────────────────────────────────────────────────────────────────
async function paso4_diligenciarComunicacionElectronica(page, browser, casoData, logs, opts = {}) {
    logs.push(`[PASO 4] Iniciando diligenciamiento fluido de formulario para Aprendiz: "${casoData.aprendiz_nombre || 'N/A'}"...`);
    await wait(200);

    // 0. Localizar el frame EXACTO donde está el formulario Unity Form de OnBase
    let formFrame = null;
    const allPages = await browser.pages().catch(() => [page]);
    for (const pg of allPages) {
        for (const frame of pg.frames()) {
            try {
                const isTarget = await frame.evaluate(() => {
                    const byId = document.getElementById('destinatarioexterno24_input') ||
                                 document.getElementById('mailto_input') ||
                                 document.getElementById('asunto27_input') ||
                                 document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
                    if (byId) return true;
                    const href = (window.location && window.location.href) || '';
                    if (href.includes('UnityFormHandler.ashx')) return true;
                    const txt = document.body ? document.body.innerText.toLowerCase() : '';
                    return (txt.includes('destinatario externo') || txt.includes('uform comunicacion electronica')) &&
                           document.querySelectorAll('input').length > 5;
                });
                if (isTarget) {
                    formFrame = frame;
                    break;
                }
            } catch (e) {}
        }
        if (formFrame) break;
    }

    if (!formFrame) {
        logs.push('[PASO 4] ⚠️ Usando marco principal como fallback.');
        formFrame = page.mainFrame ? page.mainFrame() : page;
    }

    // Helper universal inyectado en el contexto del navegador para manipulación nativa del DOM
    const locatorScript = `
        function getDeepestLabel(searchText, excludeText) {
            const candidates = Array.from(document.querySelectorAll('label, td, th, span, div, b, strong')).filter(el => {
                const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                const hasSearch = txt.includes(searchText.toLowerCase());
                const hasExclude = excludeText ? txt.includes(excludeText.toLowerCase()) : false;
                const isTipoHeader = txt.includes('tipo de destinatario') || txt.includes('seleccione tipo');
                if (searchText.toLowerCase().includes('nombre') && isTipoHeader) return false;
                return hasSearch && !hasExclude;
            });
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => ((a.innerText || a.textContent || '').trim().length - (b.innerText || b.textContent || '').trim().length));
            return candidates[0];
        }

        function getAssociatedInput(labelEl) {
            if (!labelEl) return null;
            let inp = labelEl.querySelector('input:not([type="hidden"]), select, textarea');
            if (inp) return inp;
            
            if (labelEl.parentElement) {
                inp = labelEl.parentElement.querySelector('input:not([type="hidden"]), select, textarea');
                if (inp) return inp;
            }
            
            if (labelEl.nextElementSibling) {
                inp = labelEl.nextElementSibling.querySelector('input:not([type="hidden"]), select, textarea') ||
                      (labelEl.nextElementSibling.tagName.match(/INPUT|SELECT|TEXTAREA/i) ? labelEl.nextElementSibling : null);
                if (inp) return inp;
            }
            
            const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            return allInputs.find(i => (labelEl.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING));
        }

        function setNativeValue(input, val) {
            if (!input) return false;
            input.focus();
            try { input.click(); } catch(e){}

            const isSelect = input.tagName.toLowerCase() === 'select';
            if (isSelect) {
                const opts = Array.from(input.options);
                const matchOpt = opts.find(o => (o.text || '').toLowerCase().includes(val.toLowerCase()) || (o.value || '').toLowerCase().includes(val.toLowerCase()));
                if (matchOpt) {
                    input.value = matchOpt.value;
                } else if (opts.length > 1) {
                    input.selectedIndex = 1;
                }
            } else if (input.tagName.toLowerCase() === 'textarea') {
                input.value = val;
                input.innerText = val;
            } else {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(input, val);
                } else {
                    input.value = val;
                }
                input.setAttribute('value', val);
            }

            const events = ['compositionstart', 'input', 'keydown', 'keypress', 'keyup', 'compositionend', 'change', 'blur'];
            for (const evtName of events) {
                try {
                    input.dispatchEvent(new Event(evtName, { bubbles: true, cancelable: true }));
                } catch(e){}
            }
            if (typeof input.oninput === 'function') try { input.oninput(); } catch(e){}
            if (typeof input.onchange === 'function') try { input.onchange(); } catch(e){}
            if (typeof input.onblur === 'function') try { input.onblur(); } catch(e){}
            return true;
        }
    `;

    // 0. Enforzar selección de "Externo"
    logs.push('[PASO 4] 1/8 Marcando tipo de destinatario: "Externo"...');
    await formFrame.evaluate(() => {
        // ID directo del radio Externo en Unity Form
        const rExterno = document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
        if (rExterno) {
            rExterno.scrollIntoView({ block: 'center' });
            rExterno.click();
            rExterno.checked = true;
            rExterno.dispatchEvent(new Event('change', { bubbles: true }));
            rExterno.dispatchEvent(new Event('click', { bubbles: true }));
            return;
        }
        // Fallback
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const r = radios.find(rad => {
            const txt = (rad.value || rad.id || rad.name || rad.parentElement?.innerText || '').toLowerCase();
            return txt.includes('externo') && !txt.includes('copia');
        });
        if (r) {
            r.click();
            r.checked = true;
            r.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }).catch(() => {});
    await wait(200);

    // 1 y 2. Destinatario Externo: Nombre y Email del Aprendiz
    const nombreAprendiz = (
        casoData.aprendiz_nombre || 
        `${casoData.aprendiz_nombres || ''} ${casoData.aprendiz_apellidos || ''}`.trim() ||
        casoData.raw_row?.['NOMBRE'] ||
        casoData.raw_row?.['NOMBRES'] ||
        casoData.raw_row?.['APRENDIZ'] ||
        'APRENDIZ'
    ).trim();

    const emailAprendiz = (
        casoData.aprendiz_correo || 
        casoData.correo ||
        casoData.email ||
        casoData.aprendiz_email ||
        casoData.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || 
        casoData.raw_row?.['CORREO REGISTRADO EN SOFIA'] || 
        casoData.raw_row?.['CORREO'] || 
        casoData.raw_row?.['EMAIL'] || 
        casoData.raw_row?.['MAIL'] ||
        casoData.raw_row?.['CORREO_ELECTRONICO'] ||
        casoData.raw_row?.['Correo'] ||
        casoData.raw_row?.['Correo Electrónico'] ||
        ''
    ).trim();

    logs.push(`[PASO 4] 1/8 Llenando "Nombre Destinatario": "${nombreAprendiz}"...`);
    logs.push(`[PASO 4] 2/8 Llenando "Email Destinatario": "${emailAprendiz}"...`);

    // Inyección DOM precisa por ID
    await formFrame.evaluate((nombre, email, helperStr) => {
        eval(helperStr);

        // Nombre Destinatario Externo: #destinatarioexterno24_input
        let nameInp = document.getElementById('destinatarioexterno24_input') ||
                      document.querySelector('input[id*="destinatarioexterno"]:not([id*="copia"])');
        if (!nameInp) {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
            nameInp = inputs.find(i => {
                const p = (i.parentElement?.innerText || i.closest('tr, div, td')?.innerText || '').toLowerCase();
                return p.includes('nombre destinatario') && !p.includes('copia');
            });
        }
        if (nameInp) {
            setNativeValue(nameInp, nombre);
        }

        // Email Destinatario Externo: #mailto_input
        // NOTA CRÍTICA: #mailto_input es el campo visible de destinatario externo.
        let emailInp = document.getElementById('mailto_input');
        if (!emailInp) {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
            emailInp = inputs.find(i => {
                const id = (i.id || '').toLowerCase();
                const p = (i.parentElement?.innerText || i.closest('tr, div, td')?.innerText || '').toLowerCase();
                return (id === 'mailto_input' || (p.includes('email destinatario') && !p.includes('copia') && !id.includes('emailusuario')));
            });
        }
        if (emailInp) {
            setNativeValue(emailInp, email);
        }
    }, nombreAprendiz, emailAprendiz, locatorScript).catch(() => {});

    // Puppeteer keyboard typing para confirmar foco y eventos
    try {
        const nameHandle = await formFrame.$('#destinatarioexterno24_input, input[id*="destinatarioexterno"]:not([id*="copia"])').catch(() => null);
        if (nameHandle) {
            await nameHandle.click({ clickCount: 3 }).catch(() => {});
            await nameHandle.press('Backspace').catch(() => {});
            await nameHandle.type(nombreAprendiz, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    try {
        const emailHandle = await formFrame.$('#mailto_input, input#mailto_input, input[id*="mailto"]').catch(() => null);
        if (emailHandle) {
            await emailHandle.click({ clickCount: 3 }).catch(() => {});
            await emailHandle.press('Backspace').catch(() => {});
            await emailHandle.type(emailAprendiz, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    // Verificación final para asegurar que mailto_input conserve la dirección de correo
    await formFrame.evaluate((email, helperStr) => {
        eval(helperStr);
        let emailInp = document.getElementById('mailto_input') || document.querySelector('input[id*="mailto"]');
        if (emailInp && emailInp.value !== email) {
            setNativeValue(emailInp, email);
        }
    }, emailAprendiz, locatorScript).catch(() => {});

    logs.push(`[PASO 4] ✅ "Nombre Destinatario" (${nombreAprendiz}) y "Email Destinatario" (${emailAprendiz}) establecidos.`);
    await wait(200);

    // 3. Asunto ('NOVEDADES DE ALUMNOS')
    const asuntoVal = (casoData.asunto || 'NOVEDADES DE ALUMNOS').trim();
    logs.push(`[PASO 4] 3/8 Seleccionando "Asunto": "${asuntoVal}"...`);

    // A. Inyección directa y disparo de autocompletado nativo + jQuery UI
    await formFrame.evaluate((asunto, helperStr) => {
        eval(helperStr);
        let asuntoInp = document.getElementById('asunto27_input') ||
                        document.querySelector('input[id*="asunto"]:not([id*="desc"])');
        if (asuntoInp) {
            setNativeValue(asuntoInp, asunto);
            try {
                if (window.$ && $(asuntoInp).autocomplete) {
                    $(asuntoInp).val(asunto);
                    $(asuntoInp).autocomplete('search', asunto);
                }
            } catch(e) {}
        }
    }, asuntoVal, locatorScript).catch(() => {});

    // B. Teclear el texto completo en el input de Asunto
    try {
        const asuntoHandle = await formFrame.$('#asunto27_input, input[id*="asunto"]:not([id*="desc"])').catch(() => null);
        if (asuntoHandle) {
            await asuntoHandle.click({ clickCount: 3 }).catch(() => {});
            await asuntoHandle.press('Backspace').catch(() => {});
            await asuntoHandle.type(asuntoVal, { delay: 15 }).catch(() => {});
            await wait(300);

            // C. HACER CLICK DIRECTO EN LA OPCIÓN DEL DROPDOWN QUE COINCIDA CON 'NOVEDADES DE ALUMNOS'
            let clickedOption = await formFrame.evaluate((targetAsunto) => {
                const items = Array.from(document.querySelectorAll('.ui-menu-item, .ui-menu-item-wrapper, li.ui-menu-item a, ul.ui-autocomplete li, div.ui-menu-item-wrapper'));
                const match = items.find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                    return t === targetAsunto.toUpperCase() || t.startsWith(targetAsunto.toUpperCase()) || t.includes(targetAsunto.toUpperCase());
                });
                if (match) {
                    match.scrollIntoView({ block: 'nearest' });
                    match.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                    match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    match.click();
                    match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    return true;
                }
                return false;
            }, asuntoVal).catch(() => false);

            if (!clickedOption) {
                // Probar en el documento superior por si el menú se renderiza fuera del iframe
                clickedOption = await page.evaluate((targetAsunto) => {
                    const items = Array.from(document.querySelectorAll('.ui-menu-item, .ui-menu-item-wrapper, li.ui-menu-item a, ul.ui-autocomplete li'));
                    const match = items.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                        return t === targetAsunto.toUpperCase() || t.startsWith(targetAsunto.toUpperCase()) || t.includes(targetAsunto.toUpperCase());
                    });
                    if (match) {
                        match.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                        match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        match.click();
                        return true;
                    }
                    return false;
                }, asuntoVal).catch(() => false);
            }

            if (!clickedOption) {
                // Fallback de teclado: ArrowDown + Enter
                await page.keyboard.press('ArrowDown').catch(() => {});
                await wait(150);
                await page.keyboard.press('Enter').catch(() => {});
                await wait(150);
            }

            // Asegurar que el input mantenga la cadena exacta "NOVEDADES DE ALUMNOS"
            await formFrame.evaluate((asunto, helperStr) => {
                eval(helperStr);
                const asuntoInp = document.getElementById('asunto27_input') ||
                                  document.querySelector('input[id*="asunto"]:not([id*="desc"])');
                if (asuntoInp) {
                    setNativeValue(asuntoInp, asunto);
                    asuntoInp.value = asunto;
                    asuntoInp.dispatchEvent(new Event('change', { bubbles: true }));
                    asuntoInp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, asuntoVal, locatorScript).catch(() => {});

            await page.keyboard.press('Tab').catch(() => {});
        }
    } catch(e) {}

    logs.push(`[PASO 4] ✅ "Asunto" confirmado y seleccionado: "${asuntoVal}".`);
    await wait(200);

    // 4. Descripción del Asunto ('Notificación')
    const descAsuntoVal = casoData.descripcion_asunto || 'Notificación';
    logs.push(`[PASO 4] 4/8 Llenando "Descripción del Asunto": "${descAsuntoVal}"...`);

    await formFrame.evaluate((desc, helperStr) => {
        eval(helperStr);
        const descInp = document.getElementById('descripcionasunto28_input') ||
                        document.querySelector('input[id*="descripcionasunto"]');
        if (descInp) setNativeValue(descInp, desc);
    }, descAsuntoVal, locatorScript).catch(() => {});

    try {
        const descHandle = await formFrame.$('#descripcionasunto28_input, input[id*="descripcionasunto"]').catch(() => null);
        if (descHandle) {
            await descHandle.click({ clickCount: 3 }).catch(() => {});
            await descHandle.type(descAsuntoVal, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    logs.push(`[PASO 4] ✅ "Descripción del Asunto" completada: "${descAsuntoVal}".`);
    await wait(200);

    // 5. Campo de Texto: Carta Combinada
    const textoCombinado = casoData.texto_combinado || casoData.texto_inicial || '';
    logs.push(`[PASO 4] 5/8 Llenando "Texto" (Carta Combinada)...`);

    await formFrame.evaluate((texto, helperStr) => {
        eval(helperStr);
        const textoInp = document.getElementById('ctxt_cuerpo_input') ||
                         document.querySelector('textarea.check_visibility') ||
                         document.querySelector('textarea');
        if (textoInp) setNativeValue(textoInp, texto);
    }, textoCombinado, locatorScript).catch(() => {});

    logs.push(`[PASO 4] ✅ "Texto" (Carta Combinada) insertado en el formulario.`);
    await wait(200);

    // 6. Adjuntar Anexo (Resolución / Documento PDF)
    const filesToAttach = [];
    const localAnexo = resolverRutaLocalPDF(casoData.anexo_path);
    if (localAnexo) {
        filesToAttach.push(localAnexo);
    }
    const localPdfCom = resolverRutaLocalPDF(casoData.comunicacion_pdf_path);
    if (localPdfCom && !filesToAttach.includes(localPdfCom)) {
        filesToAttach.push(localPdfCom);
    }

    if (filesToAttach.length > 0) {
        for (let fIdx = 0; fIdx < filesToAttach.length; fIdx++) {
            const pdfFile = filesToAttach[fIdx];
            logs.push(`[PASO 4] 6/8 Adjuntando resolución/anexo PDF (${fIdx + 1}/${filesToAttach.length}): "${path.basename(pdfFile)}"...`);

            let attachedSuccess = false;
            await formFrame.evaluate(() => {
                const selects = Array.from(document.querySelectorAll('select'));
                const attSelect = selects.find(s => {
                    const txt = (s.parentElement?.innerText || s.closest('tr, div, td')?.innerText || '').toLowerCase();
                    return txt.includes('anexo') || txt.includes('attachment');
                });
                if (attSelect && attSelect.options.length > 1) {
                    if (attSelect.selectedIndex <= 0) attSelect.selectedIndex = 1;
                    attSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }).catch(() => {});

            const attachBtnHandle = await formFrame.$('#attachment68_container_button, .file_input_button, input[value*="Adjuntar"]').catch(() => null);

            if (attachBtnHandle) {
                try {
                    const fcPromise = page.waitForFileChooser({ timeout: 4000 }).catch(() => null);
                    await attachBtnHandle.click().catch(() => {});
                    const fileChooser = await fcPromise;
                    if (fileChooser) {
                        await fileChooser.accept([pdfFile]);
                        attachedSuccess = true;
                        logs.push(`[PASO 4] ✅ Archivo PDF (${path.basename(pdfFile)}) adjuntado mediante selector de archivos.`);
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                try {
                    const fileInputs = await formFrame.$$('input[type="file"]');
                    if (fileInputs && fileInputs.length > 0) {
                        for (const fInput of fileInputs) {
                            await fInput.uploadFile(pdfFile);
                            attachedSuccess = true;
                            logs.push(`[PASO 4] ✅ Archivo PDF (${path.basename(pdfFile)}) cargado en input file.`);
                            break;
                        }
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                logs.push(`[PASO 4] ⚠️ Advertencia: No se pudo verificar la adjunción de "${path.basename(pdfFile)}".`);
            }
            await wait(200);
        }
    } else {
        logs.push(`[PASO 4] ⚠️ Archivo PDF no encontrado o sin ruta registrada.`);
    }
    await wait(200);

    // 7. Copias Externas (CC)
    let copyEmailsList = [];
    if (casoData.copy_emails) {
        try {
            copyEmailsList = typeof casoData.copy_emails === 'string' ? JSON.parse(casoData.copy_emails) : casoData.copy_emails;
        } catch (e) {}
    }

    if (Array.isArray(copyEmailsList) && copyEmailsList.length > 0) {
        logs.push(`[PASO 4] 7/8 Agregando ${copyEmailsList.length} correos EXCLUSIVAMENTE en Copias Externas (CC)...`);

        try {
            for (let i = 0; i < copyEmailsList.length; i++) {
                const currentCount = await formFrame.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input[id*="destinatarioexternocopia"], input[id*="mailcc"]'));
                    return Math.floor(inputs.length / 2);
                }).catch(() => 0);

                if (i >= currentCount) {
                    await formFrame.evaluate(() => {
                        const ccHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return t.includes('copias externas') && !t.includes('interna');
                        });
                        if (ccHeader) {
                            const container = ccHeader.closest('tr, table, div, fieldset') || ccHeader.parentElement;
                            const addBtn = container ? container.querySelector('input.addItem, button.addItem, .addItem, input[type="button"]') : null;
                            if (addBtn) {
                                addBtn.scrollIntoView({ block: 'center' });
                                addBtn.click();
                                return true;
                            }
                        }
                        const addBtns = Array.from(document.querySelectorAll('input.addItem, button.addItem, .addItem'));
                        if (addBtns.length >= 2) {
                            addBtns[1].click();
                            return true;
                        } else if (addBtns.length === 1) {
                            addBtns[0].click();
                            return true;
                        }
                        return false;
                    }).catch(() => {});
                    await wait(350);
                }
            }

            await formFrame.evaluate((ccList, helperStr) => {
                eval(helperStr);
                const ccHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    return t.includes('copias externas') && !t.includes('interna');
                });
                const nextHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    return t.includes('asociar a otras') || t.includes('enviar');
                });

                const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
                const ccInputs = allInputs.filter(inp => {
                    const id = (inp.id || '').toLowerCase();
                    if (id.includes('destinatarioexternocopia') || id.includes('mailcc')) return true;
                    if (ccHeader) {
                        const afterCC = (ccHeader.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING);
                        const beforeNext = nextHeader ? (inp.compareDocumentPosition(nextHeader) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
                        return afterCC && beforeNext;
                    }
                    return false;
                });

                for (let i = 0; i < ccList.length; i++) {
                    const ccItem = ccList[i];
                    const nameVal = ccItem.name || (ccItem.email ? ccItem.email.split('@')[0] : 'Destinatario CC');
                    const emailVal = ccItem.email || '';

                    const nameInp = ccInputs[i * 2];
                    const emailInp = ccInputs[i * 2 + 1];

                    if (nameInp) setNativeValue(nameInp, nameVal);
                    if (emailInp) setNativeValue(emailInp, emailVal);
                }
            }, copyEmailsList, locatorScript).catch(() => {});
        } catch(e){}

        logs.push(`[PASO 4] ✅ ${copyEmailsList.length} Copias Externas (CC) registradas con Nombre Destinatario y Email Destinatario.`);
    }

    // 8. Dar clic en el botón "Enviar" (salvo que sea solo_diligenciar)
    if (!opts.solo_diligenciar) {
        logs.push(`[PASO 4] 8/8 Clic en botón "Enviar" para radicar la Comunicación Electrónica...`);
        await wait(400);

        let sent = false;

        // A. Búsqueda en el marco del formulario
        let sendHandle = await formFrame.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"], button[value*="Enviar"], input.ui-button-label-wrap').catch(() => null);

        // B. Búsqueda en la página principal si no está en el iframe
        if (!sendHandle) {
            sendHandle = await page.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"], button[value*="Enviar"]').catch(() => null);
        }

        // C. Búsqueda exhaustiva en todos los marcos abiertos
        if (!sendHandle) {
            const allPages = await browser.pages().catch(() => [page]);
            for (const pg of allPages) {
                for (const fr of pg.frames()) {
                    const h = await fr.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"]').catch(() => null);
                    if (h) {
                        sendHandle = h;
                        break;
                    }
                }
                if (sendHandle) break;
            }
        }

        if (sendHandle) {
            await sendHandle.scrollIntoView({ block: 'center' }).catch(() => {});
            await sendHandle.click().catch(() => {});
            sent = true;
        }

        // Fallback DOM dispatch
        if (!sent) {
            sent = await formFrame.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a, div[role="button"]'));
                const sendBtn = btns.find(b => {
                    const txt = (b.value || b.innerText || b.textContent || '').trim().toLowerCase();
                    return txt === 'enviar' || txt === 'enviar comunicación' || (txt.includes('enviar') && !txt.includes('asociar'));
                });

                if (sendBtn) {
                    sendBtn.scrollIntoView({ block: 'center' });
                    sendBtn.focus();
                    sendBtn.click();
                    if (sendBtn.form) {
                        try { sendBtn.form.submit(); } catch(e){}
                    }
                    return true;
                }
                return false;
            }).catch(() => false);
        }

        if (sent) {
            logs.push(`[PASO 4] ✅ Clic en el botón "Enviar" completado exitosamente. Comunicación enviada.`);
        } else {
            logs.push(`[PASO 4] ⚠️ Botón "Enviar" no localizado automáticamente en la pantalla.`);
        }
    } else {
        logs.push(`[PASO 4] ✅ Formulario completamente diligenciado. Listo en pantalla para inspección antes de enviar.`);
    }

    return true;
}



// ─────────────────────────────────────────────────────────────────
// PASO 3: CÓDIGO DE EXPEDIENTE
// ─────────────────────────────────────────────────────────────────
async function paso3_codigoExpediente(page, browser, code, logs) {
    if (!code) {
        logs.push('[PASO 3] Sin código de expediente, saltando...');
        return null; // retorna formPage para los siguientes pasos
    }
    logs.push(`[PASO 3] Buscando campo "Código Expediente" para código: "${code}"`);

    let formPage = null;
    let formFrame = null;
    let comboInput = null; // ElementHandle del input

    // Esperar hasta 20s que aparezca el formulario con el campo
    for (let t = 0; t < 40 && !comboInput; t++) {
        await wait(500);
        await checkAndClearLocks(browser, logs);
        const allPages = await browser.pages();

        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const handle = await frame.evaluateHandle(() => {
                        // Estrategia 1: por atributos específicos de OnBase
                        const byAttr = document.querySelector(
                            'input[title*="xpediente" i], input[name*="xpediente" i], input[id*="xpediente" i]'
                        );
                        if (byAttr && !byAttr.readOnly) return byAttr;

                        // Estrategia 2: buscar el label "Código Expediente" en la página
                        // En OnBase el label está en la celda anterior del TR
                        const tds = Array.from(document.querySelectorAll('td, th, label, span, div'));
                        const labelEl = tds.find(el => {
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return t === 'código expediente' || t === 'codigo expediente'
                                || t.startsWith('código exp') || t.startsWith('codigo exp');
                        });
                        if (labelEl) {
                            // Buscar el input en el mismo TR o el siguiente TR
                            const row = labelEl.closest('tr');
                            if (row) {
                                const inp = row.querySelector('input:not([type="hidden"]):not([readonly])');
                                if (inp) return inp;
                                // Puede estar en el TR siguiente
                                const nextRow = row.nextElementSibling;
                                if (nextRow) {
                                    const inp2 = nextRow.querySelector('input:not([type="hidden"]):not([readonly])');
                                    if (inp2) return inp2;
                                }
                            }
                            // Buscar en el elemento padre
                            let parent = labelEl.parentElement;
                            for (let i = 0; i < 4 && parent; i++) {
                                const inp = parent.querySelector('input:not([type="hidden"]):not([readonly])');
                                if (inp) return inp;
                                parent = parent.parentElement;
                            }
                        }
                        return null;
                    });

                    const el = handle.asElement();
                    if (el) {
                        comboInput = el;
                        formPage = pg;
                        formFrame = frame;
                        logs.push(`[PASO 3] ✅ Campo encontrado en t=${(t * 0.5).toFixed(1)}s — URL: ${pg.url().substring(0, 60)}`);
                        break;
                    }
                } catch { }
            }
            if (comboInput) break;
        }
    }

    if (!comboInput) {
        logs.push('[PASO 3][WARN] Campo "Código Expediente" no encontrado. Usando fallback.');
        formPage = page;
        formFrame = page.mainFrame();
    } else {
        // Enfocar la página correcta
        await formPage.bringToFront();
        await wait(500);

        // Diagnóstico: qué inputs hay en el frame
        const inputInfo = await formFrame.evaluate(() => {
            return Array.from(document.querySelectorAll('input:not([type="hidden"])'))
                .slice(0, 6)
                .map(el => ({ type: el.type, title: el.title, name: el.name, id: el.id, ro: el.readOnly }));
        }).catch(() => []);
        logs.push(`[PASO 3] Inputs en frame: ${JSON.stringify(inputInfo)}`);

        // Escribir el código con keyboard.type nativo sobre el frame
        // (triple clic para limpiar primero)
        try {
            await comboInput.click({ clickCount: 3 });
            await wait(200);
            await comboInput.press('Delete');
            await wait(150);

            // Usar keyboard.type del frame (NO de page ni formPage)
            // Enfocamos el input y usamos page del frame para escribir
            await comboInput.focus();
            await wait(200);

            // Escribir carácter a carácter con delay
            logs.push(`[PASO 3] Escribiendo "${code}" (${code.length} chars, delay 150ms)...`);
            for (const char of code) {
                await formPage.keyboard.type(char, { delay: 0 });
                await wait(150);
            }

            // Verificar valor escrito
            const valEscrito = await formFrame.evaluate(el => el.value, comboInput).catch(() => '?');
            logs.push(`[PASO 3] Valor en campo tras escritura: "${valEscrito}"`);

            if (valEscrito === code) {
                logs.push('[PASO 3] ✅ Código escrito correctamente');
            } else {
                logs.push(`[PASO 3][WARN] Valor esperado "${code}", en campo "${valEscrito}"`);
            }
        } catch (e) {
            logs.push(`[PASO 3][ERROR] Al escribir código: ${e.message}`);
        }
    }

    // Esperar dropdown de sugerencias de OnBase (hasta 12s)
    logs.push('[PASO 3] Esperando dropdown de OnBase...');
    const DROPDOWN_SELS = [
        'ul.CodeEntry_DropdownList_ItemRowList li',
        '.CodeEntry_DropdownList li',
        'table.AutoCompleteList td',
        '.ac_results li',
        '.ui-autocomplete li.ui-menu-item',
        '[role="listbox"] [role="option"]',
        '[role="option"]',
        'div[class*="dropdown" i] div[class*="item" i]',
        'li[class*="suggestion" i]',
        'div[class*="CodeEntry" i] li',
    ];

    let dropdownHandled = false;

    for (let t = 0; t < 8 && !dropdownHandled; t++) {
        await wait(500);
        const allPages = await browser.pages();

        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const frameEl = await frame.frameElement().catch(() => null);
                    let offX = 0, offY = 0;
                    if (frameEl) {
                        const box = await frameEl.boundingBox().catch(() => null);
                        if (box) { offX = box.x; offY = box.y; }
                    }

                    const suggestion = await frame.evaluate((sels, sc) => {
                        for (const sel of sels) {
                            const items = Array.from(document.querySelectorAll(sel)).filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.width > 0 && r.height > 0;
                            });
                            if (items.length > 0) {
                                // Preferir el que contiene el código
                                const exact = items.find(i =>
                                    (i.innerText || i.textContent || '').includes(sc)
                                );
                                const target = exact || items[0];
                                const r = target.getBoundingClientRect();
                                return {
                                    lx: r.left + r.width / 2,
                                    ly: r.top + r.height / 2,
                                    text: (target.innerText || target.textContent || '').trim().substring(0, 80),
                                    sel
                                };
                            }
                        }
                        return null;
                    }, DROPDOWN_SELS, code);

                    if (suggestion) {
                        logs.push(`[PASO 3] ✅ Dropdown detectado t=${(t * 0.5).toFixed(1)}s → "${suggestion.text}"`);
                        await pg.mouse.click(offX + suggestion.lx, offY + suggestion.ly);
                        logs.push('[PASO 3] Clic en sugerencia. Esperando autorrelleno (3s)...');
                        await wait(3000);
                        dropdownHandled = true;
                        break;
                    }
                } catch { }
            }
            if (dropdownHandled) break;
        }
    }

    if (!dropdownHandled) {
        logs.push('[PASO 3][WARN] Dropdown no detectado. Fallback: ArrowDown + Enter');
        if (formPage) {
            await formPage.keyboard.press('ArrowDown');
            await wait(600);
            await formPage.keyboard.press('ArrowDown');
            await wait(300);
            await formPage.keyboard.press('Enter');
            await wait(3000);
        }
    }

    // Leer campos autorrellenos
    if (formFrame) {
        const autoFilled = await formFrame.evaluate(() => {
            return Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="button"])'))
                .filter(el => el.value && el.value.trim())
                .map(el => ({
                    title: el.title || el.name || el.id || '?',
                    value: el.value.trim().substring(0, 60),
                    ro: el.readOnly
                }));
        }).catch(() => []);
        logs.push(`[PASO 3] Campos con valor tras selección: ${autoFilled.length}`);
        autoFilled.forEach(f => logs.push(`[PASO 3]   [${f.ro ? 'RO' : 'RW'}] ${f.title}: "${f.value}"`));
    }

    logs.push('[PASO 3] ✅ Código Expediente completado');
    return { formPage, formFrame, success: !!comboInput };
}

// ─────────────────────────────────────────────────────────────────
// PASO 4: LLENAR CAMPOS DEL FORMULARIO
// ─────────────────────────────────────────────────────────────────

async function llenarCampoTexto(frame, pg, labelKeyword, value, logs) {
    if (!value || !frame) return false;
    try {
        const success = await frame.evaluate((kw, val) => {
            const inputs = Array.from(document.querySelectorAll(
                'input[type="text"]:not([readonly]):not([disabled]), ' +
                'input:not([type]):not([readonly]):not([disabled]), ' +
                'textarea:not([readonly]):not([disabled])'
            ));
            for (const inp of inputs) {
                const candidateTexts = [];
                const tr = inp.closest('tr');
                if (tr) candidateTexts.push((tr.innerText || tr.textContent || '').toLowerCase());
                const td = inp.closest('td');
                if (td && td.previousElementSibling) candidateTexts.push((td.previousElementSibling.innerText || td.previousElementSibling.textContent || '').toLowerCase());
                candidateTexts.push((inp.title || '').toLowerCase());
                candidateTexts.push((inp.name || '').toLowerCase());
                candidateTexts.push((inp.id || '').toLowerCase());
                candidateTexts.push((inp.placeholder || '').toLowerCase());
                if (inp.id) {
                    const lbl = document.querySelector(`label[for="${inp.id}"]`);
                    if (lbl) candidateTexts.push((lbl.innerText || '').toLowerCase());
                }

                const kwLower = kw.toLowerCase();
                if (candidateTexts.some(t => t.includes(kwLower))) {
                    inp.scrollIntoView({ block: 'center' });
                    inp.focus();
                    inp.value = val;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.blur();
                    return true;
                }
            }
            return false;
        }, labelKeyword, value);

        if (success) {
            logs.push(`[PASO 4] ✅ "${labelKeyword}" → "${value}"`);
            await wait(200);
            return true;
        } else {
            logs.push(`[PASO 4][WARN] Campo "${labelKeyword}" no encontrado`);
            return false;
        }
    } catch (e) {
        logs.push(`[PASO 4][WARN] "${labelKeyword}": ${e.message?.substring(0, 80)}`);
        return false;
    }
}


/**
 * Cambia un <select> por valor de opción (texto).
 */
async function llenarSelect(frame, labelKeyword, value, logs) {
    if (!value || !frame) return false;
    try {
        const filled = await frame.evaluate((kw, val) => {
            const selects = Array.from(document.querySelectorAll('select:not([disabled])'));
            for (const sel of selects) {
                const texts = [];
                const tr = sel.closest('tr');
                if (tr) texts.push((tr.innerText || '').toLowerCase());
                const td = sel.closest('td');
                if (td && td.previousElementSibling)
                    texts.push((td.previousElementSibling.innerText || '').toLowerCase());
                texts.push((sel.title || '').toLowerCase());
                texts.push((sel.name || '').toLowerCase());
                texts.push((sel.id || '').toLowerCase());

                if (texts.some(t => t.includes(kw.toLowerCase()))) {
                    const opts = Array.from(sel.options);
                    const opt = opts.find(o =>
                        o.text.trim().toLowerCase() === val.toLowerCase() ||
                        o.text.trim().toLowerCase().includes(val.toLowerCase())
                    );
                    if (opt) sel.value = opt.value;
                    else {
                        // Intentar por value directo
                        const byVal = opts.find(o => o.value.toLowerCase().includes(val.toLowerCase()));
                        if (byVal) sel.value = byVal.value;
                        else sel.value = val;
                    }
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    return { found: true, selected: sel.options[sel.selectedIndex]?.text || sel.value };
                }
            }
            return { found: false };
        }, labelKeyword, value);

        if (filled?.found) {
            logs.push(`[PASO 4] ✅ Select "${labelKeyword}" → "${filled.selected}"`);
            return true;
        } else {
            logs.push(`[PASO 4][WARN] Select "${labelKeyword}" no encontrado`);
            return false;
        }
    } catch (e) {
        logs.push(`[PASO 4][WARN] Select "${labelKeyword}": ${e.message?.substring(0, 80)}`);
        return false;
    }
}

async function paso4_llenarCampos(formPage, formFrame, docInfo, logs) {
    if (!formPage || !formFrame) {
        logs.push('[PASO 4][WARN] No hay formFrame, saltando llenado de campos');
        return;
    }
    logs.push('[PASO 4] Llenando campos del formulario SGDEA - Ingreso a Expediente...');

    // Datos del documento
    const tipologia = (docInfo.typology_name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const nombreDoc = (docInfo.joinedName || docInfo.nombreDocumento || docInfo.filename || '').trim();
    let docDate = '';
    if (docInfo.document_date) {
        // Formato exacto que acepta OnBase: DD/MM/YYYY HH:MM:SS
        const d = new Date(docInfo.document_date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        docDate = `${dd}/${mm}/${yyyy} 0:00:00`;
    }

    // Diagnóstico inicial: mostrar todos los campos del formulario
    await wait(1000);
    const diagnostico = await formFrame.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll(
            'input:not([type="hidden"]), select, textarea'
        )).map(el => {
            const tr = el.closest('tr, .field-row, .form-group');
            const rowTxt = (tr ? tr.innerText || tr.textContent : '').trim().substring(0, 80);
            return `[${el.tagName}][${el.type||''}] title="${el.title}" name="${el.name}" id="${el.id}" rowTxt="${rowTxt}"`;
        });
        return inputs;
    }).catch(() => []);
    diagnostico.forEach(d => logs.push(`[PASO 4][DIAG] ${d}`));

    // Función que diligencia el campo basándose en selectores CSS exactos para los IDs de OnBase
    const typeFieldNativeById = async (selector, valueToType, fieldName, isDropdown=false) => {
        if (!valueToType) return false;
        logs.push(`[PASO 4] Buscando "${fieldName}" (Selector: ${selector})...`);
        let comboInput = null;
        
        try {
            const handle = await formFrame.evaluateHandle((sel) => {
                const els = Array.from(document.querySelectorAll(sel));
                // Preferir inputs que no sean de solo lectura
                return els.find(e => !e.readOnly && !e.disabled) || els[0] || null;
            }, selector);

            comboInput = handle.asElement();
        } catch(e) { }
        
        if (!comboInput) {
            logs.push(`[PASO 4][WARN] Campo "${fieldName}" no encontrado.`);
            return false;
        }

        try {
            await comboInput.click({ clickCount: 3 });
            await wait(200);
            await comboInput.press('Delete');
            await wait(150);
            await comboInput.focus();
            await wait(200);

            // Si es Tipo Documental o campo con dropdown, aplicar mecanografía inteligente y búsqueda semántica
            let searchKey = valueToType;
            let typingText = valueToType;

            if (fieldName.toLowerCase().includes('tipo documental')) {
                // Si la tipología tiene un alias guardado previamente en BD, usarlo directamente
                let savedAlias = null;
                try {
                    const aliasRes = await pool.query(
                        'SELECT onbase_name FROM trd_typologies WHERE (typology_name ILIKE $1 OR onbase_name ILIKE $1) AND onbase_name IS NOT NULL LIMIT 1',
                        [valueToType.trim()]
                    );
                    if (aliasRes && aliasRes.rows && aliasRes.rows[0]?.onbase_name) {
                        savedAlias = aliasRes.rows[0].onbase_name;
                        logs.push(`[PASO 4] 💡 Equivalencia previa encontrada en BD para "${valueToType.substring(0,35)}..." ➔ "${savedAlias}"`);
                    }
                } catch (dbErr) { }

                if (savedAlias) {
                    typingText = savedAlias;
                    searchKey = savedAlias;
                } else {
                    // Extraer palabras clave principales (sin preposiciones) para filtrar el dropdown sin bloquearlo
                    const stopWords = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'Y', 'O', 'A', 'AL', 'PARA', 'POR', 'CON', 'SIN', 'SOBRE']);
                    const tokens = valueToType
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .toUpperCase()
                        .split(/[^A-Z0-9]+/)
                        .filter(w => w.length > 1 && !stopWords.has(w));
                    
                    if (tokens.length > 0) {
                        // Tipear la primera o primeras dos palabras clave para abrir opciones
                        typingText = tokens.slice(0, Math.min(2, tokens.length)).join(' ');
                        logs.push(`[PASO 4] 🔍 Filtrando dropdown OnBase con palabras clave: "${typingText}" (TRD completa: "${valueToType.substring(0,40)}...")`);
                    }
                }
            }

            logs.push(`[PASO 4] Escribiendo en ${fieldName}: "${typingText.substring(0,40)}"`);
            for (const char of typingText) {
                await formPage.keyboard.type(char, { delay: 0 });
                await wait(20); // ms por letra para simular mecanografía rápida
            }

            const valEscrito = await formFrame.evaluate(el => el.value, comboInput).catch(() => '?');
            logs.push(`[PASO 4] Valor en campo tras escritura: "${valEscrito}"`);

            if (isDropdown) {
                logs.push(`[PASO 4] Esperando dropdown de OnBase para ${fieldName}...`);
                const DROPDOWN_SELS = [
                    'ul.CodeEntry_DropdownList_ItemRowList li',
                    '.CodeEntry_DropdownList li',
                    'table.AutoCompleteList td',
                    '.ac_results li',
                    '.ui-autocomplete li.ui-menu-item',
                    '[role="listbox"] [role="option"]',
                    '[role="option"]',
                    'div[class*="dropdown" i] div[class*="item" i]',
                    'li[class*="suggestion" i]',
                    'div[class*="CodeEntry" i] li',
                ];

                let dropdownHandled = false;
                for (let t = 0; t < 15 && !dropdownHandled; t++) {
                    await wait(400);
                    const allPages = await formPage.browser().pages();
                    for (const pg of allPages) {
                        for (const frame of pg.frames()) {
                            try {
                                const frameEl = await frame.frameElement().catch(() => null);
                                let offX = 0, offY = 0;
                                if (frameEl) {
                                    const box = await frameEl.boundingBox().catch(() => null);
                                    if (box) { offX = box.x; offY = box.y; }
                                }

                                const suggestion = await frame.evaluate((sels, originalText, typedVal) => {
                                    const cleanText = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                                    const targetClean = cleanText(originalText);
                                    const typedClean = cleanText(typedVal);
                                    const targetWords = targetClean.split(' ').filter(w => w.length > 2);

                                    // Generar acrónimo/siglas del texto original (ej. "CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL" -> "CDP")
                                    const acronym = targetClean.split(' ').filter(w => !['DE','DEL','LA','EL','EN','Y','PARA','POR','CON'].includes(w)).map(w => w[0]).join('');

                                    for (const sel of sels) {
                                        const items = Array.from(document.querySelectorAll(sel)).filter(el => {
                                            const r = el.getBoundingClientRect();
                                            return r.width > 0 && r.height > 0;
                                        });

                                        if (items.length > 0) {
                                            let bestItem = null;
                                            let bestScore = -1;

                                            for (const item of items) {
                                                const itemText = cleanText(item.innerText || item.textContent);
                                                if (!itemText) continue;

                                                let score = 0;
                                                // 1. Coincidencia exacta
                                                if (itemText === targetClean || itemText === typedClean) {
                                                    score = 1000;
                                                }
                                                // 2. Coincidencia por acrónimo / sigla exacta (ej. "CDP", "RP", "RUT")
                                                else if (acronym.length >= 2 && (itemText === acronym || itemText.startsWith(acronym + ' '))) {
                                                    score = 800;
                                                }
                                                // 3. Contención bidireccional
                                                else if (targetClean.includes(itemText)) {
                                                    // La opción de OnBase está contenida completa en la TRD (muy común)
                                                    score = 500 + itemText.length;
                                                } else if (itemText.includes(targetClean)) {
                                                    score = 400 + targetClean.length;
                                                } else if (itemText.includes(typedClean) || typedClean.includes(itemText)) {
                                                    score = 300;
                                                } else {
                                                    // 4. Conteo de palabras clave coincidentes
                                                    const itemWords = itemText.split(' ').filter(w => w.length > 2);
                                                    let commonWords = 0;
                                                    for (const tw of targetWords) {
                                                        if (itemWords.includes(tw)) commonWords++;
                                                    }
                                                    if (commonWords > 0) {
                                                        score = 100 + (commonWords * 20);
                                                    }
                                                }

                                                if (score > bestScore) {
                                                    bestScore = score;
                                                    bestItem = item;
                                                }
                                            }

                                            const target = bestItem || items[0];
                                            const r = target.getBoundingClientRect();
                                            return {
                                                lx: r.left + r.width / 2,
                                                ly: r.top + r.height / 2,
                                                text: (target.innerText || target.textContent || '').trim().substring(0, 80),
                                                score: bestScore
                                            };
                                        }
                                    }
                                    return null;
                                }, DROPDOWN_SELS, valueToType, typingText);

                                if (suggestion) {
                                    logs.push(`[PASO 4] ✅ Dropdown detectado para ${fieldName} → "${suggestion.text}" (Score: ${suggestion.score})`);
                                    await pg.mouse.click(offX + suggestion.lx, offY + suggestion.ly);
                                    await wait(1500); // Tiempo para autorrelleno

                                    // Si es Tipo Documental, auto-aprender y guardar la equivalencia en la BD
                                    if (fieldName.toLowerCase().includes('tipo documental') && suggestion.text) {
                                        try {
                                            const recognized = suggestion.text.trim().toUpperCase();
                                            await pool.query(
                                                'UPDATE trd_typologies SET onbase_name = $1 WHERE (typology_name ILIKE $2 OR id = $3) AND (onbase_name IS NULL OR onbase_name = \'\')',
                                                [recognized, `%${valueToType.trim()}%`, docInfo?.typology_id || 0]
                                            );
                                            logs.push(`[PASO 4] 💾 Equivalencia guardada en BD: "${valueToType.substring(0,35)}..." ➔ "${recognized}"`);
                                        } catch (dbSaveErr) { }
                                    }

                                    dropdownHandled = true;
                                    break;
                                }
                            } catch { }
                        }
                        if (dropdownHandled) break;
                    }
                }

                if (!dropdownHandled) {
                    logs.push(`[PASO 4][WARN] Dropdown no detectado para ${fieldName}. Fallback: ArrowDown + Enter`);
                    await formPage.keyboard.press('ArrowDown');
                    await wait(600);
                    await formPage.keyboard.press('ArrowDown');
                    await wait(300);
                    await formPage.keyboard.press('Enter');
                    await wait(1500);
                }
            } else {
                await formPage.keyboard.press('Tab');
            }
            
            logs.push(`[PASO 4] ✅ ${fieldName} completado`);
            await wait(400);
            return true;

        } catch(e) {
            logs.push(`[PASO 4][ERROR] Al escribir en ${fieldName}: ${e.message}`);
            return false;
        }
    };

    // ── ORDEN ESTRICTO DEL FORMULARIO ──

    // 1. Grupo Documental (id*="grupodocumental")
    await typeFieldNativeById('input[id*="grupodocumental" i]', 'TRD', 'Grupo Documental', true);

    // 2. Tipo Documental (id*="tipodocumental")
    if (tipologia) {
        await typeFieldNativeById('input[id*="tipodocumental" i], input[id*="tipodoc" i]', tipologia, 'Tipo Documental', true);
    }

    // 3. Nombre Documento (id*="nombredocumento")
    if (nombreDoc) {
        await typeFieldNativeById('input[id*="nombredocumento" i], input[name*="nombredocumento" i]', nombreDoc, 'Nombre Documento', false);
    }

    // 4. Origen (id*="origen")
    await typeFieldNativeById('input[id*="origen" i]', 'ELECTRONICO', 'Origen', true);

    // ─── CAMPO 5: Fecha Creacion Documento ───
    if (docDate) {
        logs.push(`[PASO 4] Llenando "Fecha Creacion Documento" con "${docDate}"...`);
        try {
            // Find the robust CSS selector by looking at surrounding text
            const dateSelector = await formFrame.evaluate(() => {
                const dateKeywords = ['fecha creacion', 'fecha creación', 'fecha de creacion', 'fecha de creación'];
                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly])'));
                
                let foundInp = null;
                // 1. Check if ID contains 'fechacreacion'
                foundInp = inputs.find(e => e.id && e.id.toLowerCase().includes('fechacreacion'));
                
                // 2. Check surrounding labels
                if (!foundInp) {
                    for (const cand of inputs) {
                        const trText = (cand.closest('tr')?.innerText || '').toLowerCase();
                        const tdText = (cand.closest('td')?.previousElementSibling?.innerText || '').toLowerCase();
                        const titleText = (cand.title || '').toLowerCase();
                        if (dateKeywords.some(kw => trText.includes(kw) || tdText.includes(kw) || titleText.includes(kw))) {
                            foundInp = cand;
                            break;
                        }
                    }
                }
                
                if (foundInp) {
                    // Try to generate a unique selector
                    if (foundInp.id) return `input#${foundInp.id}`;
                    if (foundInp.name) return `input[name="${foundInp.name}"]`;
                    return null;
                }
                return null;
            }).catch(() => null);

            logs.push(`[PASO 4] Selector dinámico encontrado para fecha: ${dateSelector || 'Nulo'}`);

            if (dateSelector) {
                logs.push(`[PASO 4] Diligenciando "Fecha Creacion Documento" con fecha base: "${docInfo.document_date}"`);
                const comboInput = await formFrame.$(dateSelector);
                if (comboInput) {
                    await formFrame.evaluate((el, dateStr) => {
                        const d = new Date(dateStr);
                        const yyyy = d.getFullYear();
                        const mm = d.getMonth() + 1;
                        const dd = d.getDate();
                        const dateObj = new Date(yyyy, mm - 1, dd, 0, 0, 0);
                        
                        let success = false;
                        if (typeof window.jQuery !== 'undefined') {
                            const $el = window.jQuery(el);
                            if (typeof $el.datetimepicker === 'function') {
                                try {
                                    $el.datetimepicker('setDate', dateObj);
                                    $el.trigger('change');
                                    success = true;
                                } catch (e) {}
                            }
                            if (!success && typeof $el.datepicker === 'function') {
                                try {
                                    $el.datepicker('setDate', dateObj);
                                    $el.trigger('change');
                                    success = true;
                                } catch (e) {}
                            }
                        }
                        
                        if (!success) {
                            el.focus();
                            el.value = `${mm}/${dd}/${yyyy} 12:00:00 AM`;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }
                    }, comboInput, docInfo.document_date);
                    logs.push(`[PASO 4] ✅ Fecha Creacion Documento asignada exitosamente`);
                } else {
                    logs.push(`[PASO 4][ERROR] No se encontró el elemento input para la fecha`);
                }
                await wait(500);
            } else {
                logs.push(`[PASO 4][ERROR] No se pudo localizar el campo "Fecha Creacion Documento". Revisa el diseñador de OnBase.`);
            }

        } catch(e) {
            logs.push(`[PASO 4][ERROR] Error procesando campo fecha: ${e.message?.substring(0, 150)}`);
        }
    }

    // Solo si hay notas en la info del documento
    if (docInfo.notes || docInfo.observaciones) {
        const notasVal = docInfo.notes || docInfo.observaciones || '';
        logs.push(`[PASO 4] Llenando "Notas"...`);
        const notasEl = await formFrame.evaluateHandle(() => {
            return document.querySelector('textarea:not([readonly]):not([disabled])');
        }).catch(() => null);
        const notasHandle = notasEl?.asElement ? notasEl.asElement() : null;
        if (notasHandle) {
            await notasHandle.click({ clickCount: 3 });
            await notasHandle.type(notasVal, { delay: 40 });
            logs.push(`[PASO 4] ✅ Notas → "${notasVal.substring(0,40)}"`);
        }
        await wait(300);
    }



    logs.push('[PASO 4] ✅ Todos los campos del formulario diligenciados');
}


// ─────────────────────────────────────────────────────────────────
// PASO 5: ADJUNTAR PDF
// ─────────────────────────────────────────────────────────────────
async function paso5_adjuntarPDF(page, allFramesFn, docInfo, logs) {
    // VIDEO CONFIRMADO: el archivo viene de la ruta OneDrive (storage_path).
    // Prioridad: LOCAL_STORAGE_PATH → storage_path (OneDrive) → path (uploads/ del servidor)
    let filePath = null;
    let primaryPath = docInfo?.storage_path || docInfo?.path;

    // Si tenemos local storage path, intentar mapear el path de la BD a local
    if (primaryPath && process.env.LOCAL_STORAGE_PATH) {
        try {
            const dbStoragePath = await new Promise((resolve) => {
                db.get("SELECT value FROM system_settings WHERE key = 'storage_path'", [], (err, row) => {
                    resolve(row?.value || null);
                });
            });
            if (dbStoragePath) {
                const normDbPath = primaryPath.replace(/\\/g, '/');
                const normDbStorage = dbStoragePath.replace(/\\/g, '/');
                if (normDbPath.startsWith(normDbStorage)) {
                    const relative = normDbPath.substring(normDbStorage.length);
                    const resolved = path.join(process.env.LOCAL_STORAGE_PATH, relative);
                    if (fs.existsSync(resolved)) {
                        filePath = resolved;
                        logs.push(`[PASO 5] Mapeado de BD a local: ${filePath}`);
                    }
                }
            }
        } catch (e) {
            logs.push(`[PASO 5][WARN] Error al mapear path local: ${e.message}`);
        }
    }

    if (!filePath) {
        if (docInfo?.storage_path && fs.existsSync(docInfo.storage_path)) {
            filePath = docInfo.storage_path;
            logs.push(`[PASO 5] Usando ruta OneDrive: ${filePath}`);
        } else if (docInfo?.path && fs.existsSync(docInfo.path)) {
            filePath = docInfo.path;
            logs.push(`[PASO 5] Usando ruta servidor (fallback): ${filePath}`);
        } else {
            logs.push(`[PASO 5][ERROR] Archivo no encontrado.`);
            logs.push(`[PASO 5][ERROR]   storage_path: ${docInfo?.storage_path || 'N/A'}`);
            logs.push(`[PASO 5][ERROR]   path: ${docInfo?.path || 'N/A'}`);
            return false;
        }
    }
    logs.push(`[PASO 5] Adjuntando: ${filePath}`);
    // Sobrescribir docInfo.path con la ruta efectiva para el fileChooser
    docInfo = { ...docInfo, path: filePath };

    try {
        // Preparar detector de FileChooser ANTES del clic
        const fileChooserPromise = page.waitForFileChooser({ timeout: 12000 });

        // Buscar y clic en botón "Importar"
        let importClicked = false;
        for (const frame of allFramesFn()) {
            try {
                const clicked = await frame.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll(
                        'button, a, input[type="button"], input[type="submit"], [role="button"]'
                    ));
                    const btn = btns.find(b => {
                        const t = (b.innerText || b.value || b.title || b.name || b.id || b.textContent || '').trim().toLowerCase();
                        const rect = b.getBoundingClientRect();
                        return t.includes('importar') && rect.width > 0;
                    });
                    if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus(); btn.click(); return true; }
                    return false;
                });
                if (clicked) { importClicked = true; break; }
            } catch { }
        }

        if (!importClicked) {
            logs.push('[PASO 5][WARN] Botón "Importar" no encontrado');
            fileChooserPromise.catch(() => { }); // cancela la espera
            return false;
        }

        logs.push('[PASO 5] Clic en "Importar". Esperando diálogo de archivo...');
        const chooser = await fileChooserPromise;
        await chooser.accept([docInfo.path]);
        logs.push(`[PASO 5] ✅ Archivo seleccionado: ${path.basename(docInfo.path)}`);
        await wait(4000); // Esperar que OnBase procese el archivo
        return true;
    } catch (e) {
        logs.push(`[PASO 5][ERROR] ${e.message}`);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────
// PASO 6: GUARDAR
async function paso6_guardar(page, allFramesFn, logs, hasMoreDocs = false) {
    logs.push('[PASO 6] Buscando botón "Guardar"...');
    try {
        const frames = allFramesFn();
        logs.push(`[PASO 6] Total frames disponibles para buscar: ${frames.length}`);
        for (let i=0; i<frames.length; i++) {
            const btnTexts = await frames[i].evaluate(() => {
                return Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
                    .map(b => {
                        const t = (b.innerText || b.value || b.title || b.name || b.id || '').trim();
                        return t ? `[${b.tagName}] ${t}` : null;
                    })
                    .filter(t => t !== null);
            });
            if (btnTexts.length > 0) {
                logs.push(`[PASO 6] Frame ${i} botones (${btnTexts.length}): ${btnTexts.join(' | ')}`);
            }
        }
    } catch(e) { logs.push(`[PASO 6][ERR_DIAG] ${e.message}`); }
    
    let saved = false;

    for (const frame of allFramesFn()) {
        try {
            saved = await frame.evaluate(() => {
                const btns = Array.from(document.querySelectorAll(
                    'button, a, input[type="button"], input[type="submit"], [role="button"]'
                ));
                const btn = btns.find(b => {
                    const t = (b.innerText || b.value || b.title || b.name || b.id || b.textContent || '').trim().toLowerCase();
                    const rect = b.getBoundingClientRect();
                    return (t === 'guardar' || t === 'save') && rect.width > 0;
                });
                if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus(); btn.click(); return true; }
                return false;
            });
            if (saved) { logs.push('[PASO 6] ✅ Botón "Guardar" presionado'); break; }
        } catch { }
    }

    if (!saved) {
        logs.push('[PASO 6][WARN] Botón "Guardar" no encontrado. Botones visibles:');
        for (const frame of allFramesFn()) {
            const btns = await safeEval(frame, () =>
                Array.from(document.querySelectorAll('button, input[type="button"]'))
                    .filter(b => b.offsetParent !== null)
                    .map(b => `"${(b.innerText || b.value || '').trim()}"`)
                    .slice(0, 15).join(', ')
            );
            if (btns) { logs.push(`[PASO 6]   ${btns}`); break; }
        }
        return false;
    }

    // Esperar y manejar diálogo post-guardado
    logs.push(`[PASO 6] Esperando diálogo post-guardado (siguiente doc en lote: ${hasMoreDocs ? 'SÍ' : 'NO'})...`);
    let dialogHandled = false;
    for (let t = 0; t < 25 && !dialogHandled; t++) {
        await wait(500);
        for (const frame of allFramesFn()) {
            try {
                dialogHandled = await frame.evaluate((wantAnother) => {
                    const candidates = Array.from(document.querySelectorAll('button, a, input, div, span, td, [role="button"]'));
                    if (wantAnother) {
                        const yesBtn = candidates.find(b => {
                            const txt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                            const isMatch = (txt === 'sí' || txt === 'si' || txt === 'yes');
                            const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                            return isMatch && isVisible;
                        });
                        if (yesBtn) {
                            yesBtn.scrollIntoView({ block: 'center' });
                            yesBtn.click();
                            return true;
                        }
                    } else {
                        const noBtn = candidates.find(b => {
                            const txt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                            const isMatch = (txt === 'no' || txt === 'cancel' || txt === 'cancelar');
                            const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                            return isMatch && isVisible;
                        });
                        if (noBtn) {
                            noBtn.scrollIntoView({ block: 'center' });
                            noBtn.click();
                            return true;
                        }
                    }
                    return false;
                }, hasMoreDocs);
                if (dialogHandled) {
                    logs.push(`[PASO 6] ✅ Diálogo post-guardado procesado (${hasMoreDocs ? 'Sí' : 'No'}) en t=${(t * 0.5).toFixed(1)}s`);
                    break;
                }
            } catch (e) { }
        }
    }

    if (!dialogHandled) {
        logs.push('[PASO 6][WARN] Diálogo post-guardado no detectado. Continuando...');
    }

    await wait(3000);
    logs.push('[PASO 6] ✅ Proceso de guardado finalizado');
    return true;
}

// ─────────────────────────────────────────────────────────────────
// PASO 7: CERRAR SESIÓN ONBASE
// ─────────────────────────────────────────────────────────────────
async function paso7_logout(page, allFramesFn, logs) {
    logs.push('[PASO 7] Iniciando cierre de sesión en OnBase...');
    let logoutClicked = false;
    
    for (let attempt = 0; attempt < 8 && !logoutClicked; attempt++) {
        await wait(1000);
        
        // 1. Verificar si el botón "Logout" o "Cerrar sesión" ya es visible
        for (const frame of allFramesFn()) {
            try {
                logoutClicked = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('a, button, span, div, li, td, [role="button"], [role="menuitem"]'));
                    const logoutWords = ['cerrar sesión', 'cerrar sesion', 'log out', 'logout', 'salir', 'exit'];
                    const logoutBtn = elements.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        const isMatch = logoutWords.some(word => t === word || t.includes(word));
                        const isVisible = el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                        return isMatch && isVisible;
                    });
                    
                    if (logoutBtn) {
                        logoutBtn.scrollIntoView({ block: 'center' });
                        // Simular secuencia completa de mouse click
                        logoutBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        logoutBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        logoutBtn.click();
                        return true;
                    }
                    return false;
                });
                
                if (logoutClicked) {
                    logs.push(`[PASO 7] ✅ Botón de cierre de sesión presionado`);
                    break;
                }
            } catch (e) {}
        }
        
        if (logoutClicked) break;
        
        // 2. Si no es visible, intentar hacer clic en el menú del usuario para abrirlo
        logs.push(`[PASO 7] Menú de logout no visible, intentando abrir menú de usuario (intento ${attempt + 1})...`);
        for (const frame of allFramesFn()) {
            try {
                await frame.evaluate(() => {
                    const userElements = Array.from(document.querySelectorAll('a, div, span, button, [class*="user" i]'));
                    const userMenu = userElements.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        // Buscar el menú del usuario
                        const isUserMenu = t.includes('jorge') || t.includes('cimi') || t.includes('regional') || el.id?.toLowerCase().includes('user') || el.className?.toLowerCase().includes('user') || el.className?.toLowerCase().includes('profile');
                        return isUserMenu && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                    });
                    if (userMenu) {
                        userMenu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        userMenu.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        userMenu.click();
                    }
                });
            } catch (e) {}
        }
    }
    
    if (!logoutClicked) {
        logs.push('[PASO 7] No se pudo hacer clic en el botón de logout. Forzando navegación a la URL de salida...');
        try {
            const currentUrl = page.url();
            const baseUrl = currentUrl.split('/AppNet/')[0];
            if (baseUrl) {
                const logoutUrl = `${baseUrl}/AppNet/Login.aspx?logout=true`;
                logs.push(`[PASO 7] Navegando a: ${logoutUrl}`);
                await page.goto(logoutUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                logoutClicked = true;
            }
        } catch (e) {
            logs.push(`[PASO 7][WARN] Error al forzar navegación de logout: ${e.message}`);
        }
    }
    
    await wait(3000);
    logs.push('[PASO 7] ✅ Cierre de sesión finalizado');
}

// ─────────────────────────────────────────────────────────────────
// EXPORTACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────
let currentJob = {
    running: false,
    jobId: null,
    currentStep: '',
    logs: [],
    error: null,
    completed: false,
    screenshot: null,
    startTime: null,
    documentIds: []
};

exports.getAutomationStatus = async (req, res) => {
    try {
        return res.json({
            success: true,
            running: currentJob.running,
            jobId: currentJob.jobId,
            currentStep: currentJob.currentStep,
            logs: (currentJob.logs || []).slice(-100),
            error: currentJob.error,
            completed: currentJob.completed,
            hasFrame: !!(currentJob.liveFrame || currentJob.screenshot)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getAutomationFrame = async (req, res) => {
    try {
        const rawB64 = currentJob.liveFrame || currentJob.screenshot;
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

exports.killActiveAutomation = async (req, res) => {
    try {
        if (activeBrowser) {
            await activeBrowser.close().catch(() => {});
            activeBrowser = null;
            activePage = null;
        }
        currentJob.running = false;
        currentJob.completed = true;
        currentJob.currentStep = 'Detenido por el usuario';
        currentJob.liveFrame = null;
        currentJob.screenshot = null;
        currentJob.logs.push('[DETENIDO] 🛑 Automatización en vivo cancelada por el usuario. Consola reiniciada.');
        automationEmitter.emit('done', currentJob);
        return res.json({ success: true, message: 'Automatización detenida y consola reiniciada.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.executeAutomation = async (req, res) => {
    try {
        let { url, username, password, documentIds, action, target_user, stop_at_step, caso_ids, force_restart } = req.body || {};
        const logs = [];

    // Si había un navegador o proceso anterior activo, cerrarlo limpiamente si se solicita force_restart o si ya no está respondiendo
    if (currentJob.running) {
        if (force_restart || activeBrowser) {
            if (activeBrowser) {
                await activeBrowser.close().catch(() => {});
                activeBrowser = null;
                activePage = null;
            }
            currentJob.running = false;
        } else {
            return res.json({
                success: true,
                jobId: currentJob.jobId,
                message: 'La automatización ya se encuentra en ejecución.',
                logs: currentJob.logs
            });
        }
    }

    let docsToProcess = [];
    if (Array.isArray(documentIds) && documentIds.length > 0) {
        try {
            const placeholders = documentIds.map(() => '?').join(',');
            const rows = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT d.*, e.expediente_code, e.title as exp_title, e.opening_date, e.subserie, e.metadata_values as exp_meta,
                           ser.series_code, ser.series_name, ser.dependency_id as series_dep_id,
                           sub.subseries_code, sub.subseries_name
                    FROM documents d
                    LEFT JOIN expedientes e ON d.expediente_id = e.id
                    LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
                    LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
                    WHERE d.id IN (${placeholders})
                `, documentIds, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            docsToProcess = rows.map(r => {
                let meta = {};
                try {
                    meta = typeof r.exp_meta === 'string' ? JSON.parse(r.exp_meta) : (r.exp_meta || {});
                } catch { }
                return {
                    ...r,
                    joinedName: r.exp_title || r.filename,
                    parsedMeta: meta
                };
            });

            logs.push(`[INFO] Lote preparado: ${docsToProcess.length} documento(s) a procesar.`);
        } catch (e) {
            logs.push(`[WARN] Error cargando lista de documentos: ${e.message}`);
        }
    }

    const jobId = Date.now().toString();
    currentJob = {
        running: true,
        jobId,
        currentStep: 'Iniciando automatización',
        logs,
        error: null,
        completed: false,
        screenshot: null,
        startTime: new Date().toISOString(),
        documentIds: documentIds || []
    };

    automationEmitter.emit('status', currentJob);

    // Responder INMEDIATAMENTE HTTP 200 para evitar 504 Gateway Timeout en Nginx
    res.json({
        success: true,
        jobId,
        message: 'Automatización iniciada exitosamente en segundo plano.',
        logs: currentJob.logs
    });

    // Ejecutar Puppeteer en segundo plano
    (async () => {
        let browser;
        try {
            activeBrowser = await puppeteer.launch({
                headless: process.platform === 'linux' ? true : false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            browser = activeBrowser;

            // Manejador global de diálogos en nuevas pestañas/páginas
            activeBrowser.on('targetcreated', async target => {
                if (target.type() === 'page') {
                    const newPage = await target.page().catch(() => null);
                    if (newPage) {
                        newPage.on('dialog', async dialog => {
                            const msg = dialog.message();
                            currentJob.logs.push(`[DIALOG] 💬 Diálogo nativo detectado en pestaña: "${msg}" (${dialog.type()}). Aceptando automáticamente...`);
                            await dialog.accept().catch(() => {});
                        });
                    }
                }
            });

            activePage = await activeBrowser.newPage();
            const page = activePage;
            await page.setViewport({ width: 1366, height: 900 });

            // Manejador de diálogos en la página principal
            page.on('dialog', async dialog => {
                const msg = dialog.message();
                currentJob.logs.push(`[DIALOG] 💬 Diálogo nativo detectado: "${msg}" (${dialog.type()}). Aceptando automáticamente...`);
                await dialog.accept().catch(() => {});
            });

            // Screencast en tiempo real con throttling optimizado (alta fluidez, bajo consumo de CPU y red)
            try {
                const session = await page.target().createCDPSession();
                await session.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 960, maxHeight: 600, everyNthFrame: 2 });
                let lastFrameTime = 0;
                session.on('Page.screencastFrame', ev => {
                    const now = Date.now();
                    currentJob.liveFrame = ev.data;
                    if (now - lastFrameTime >= 500) {
                        lastFrameTime = now;
                        automationEmitter.emit('frame', ev.data);
                    }
                    session.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => { });
                });
            } catch { }

            const allFrames = () => page.frames();

            // ── RESOLUCIÓN DE CREDENCIALES POR TRD Y DEPENDENCIA ──
            const orgRows = await new Promise(resolve => {
                db.all("SELECT id, section_name, subsection_name, section_code, subsection_code, onbase_user, onbase_pass, onbase_username, onbase_password FROM organization_structure", [], (err, rows) => {
                    resolve(rows || []);
                });
            });

            const findOrg = (subCode) => {
                return orgRows.find(o => subCode ? o.subsection_code === subCode : (!o.subsection_code || o.subsection_code === '')) || null;
            };

            const orgSub = findOrg('') || { id: 6, section_name: 'Subdirección de Centro', subsection_code: '', onbase_user: 'TVILLAMIZARJ', onbase_pass: 'Sena2026**onbase' };
            const orgAdmin = findOrg('9224.2') || { id: 7, subsection_name: 'Grupo Administración Educativa', subsection_code: '9224.2', onbase_user: 'luepitar', onbase_pass: 'Automatizador2026*' };
            const orgForm = findOrg('9224.4') || { id: 8, subsection_name: 'Grupo de Formación Profesional Integral', subsection_code: '9224.4', onbase_user: 'EDHERNANDEZM', onbase_pass: 'Sena2026**onbase' };

            const getU = (org, fallbackU) => (org?.onbase_user || org?.onbase_username || fallbackU).trim();
            const getP = (org, fallbackP) => (org?.onbase_pass || org?.onbase_password || fallbackP).trim();

            const resolveDocCreds = (doc) => {
                // Si el usuario forzó explícitamente un usuario de OnBase (diferente de 'auto')
                if (target_user && target_user !== 'auto') {
                    const tu = String(target_user).toLowerCase().trim();
                    if (tu.includes('edhernandezm') || tu.includes('formacion') || tu.includes('9224.4')) {
                        return {
                            depKey: '9224.4',
                            depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                            depCode: '9224.4',
                            username: getU(orgForm, 'EDHERNANDEZM'),
                            password: getP(orgForm, 'Sena2026**onbase'),
                            rule: 'Selección explícita de usuario (Formación Profesional)'
                        };
                    }
                    if (tu.includes('luepitar') || tu.includes('administracion') || tu.includes('9224.2')) {
                        return {
                            depKey: '9224.2',
                            depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                            depCode: '9224.2',
                            username: getU(orgAdmin, 'luepitar'),
                            password: getP(orgAdmin, 'Automatizador2026*'),
                            rule: 'Selección explícita de usuario (Adm. Educativa)'
                        };
                    }
                    if (tu.includes('tvillamizar') || tu.includes('jrrozo') || tu.includes('subdireccion') || tu.includes('9224')) {
                        return {
                            depKey: '9224',
                            depName: orgSub.section_name || 'Subdirección de Centro',
                            depCode: '9224',
                            username: getU(orgSub, 'TVILLAMIZARJ'),
                            password: getP(orgSub, 'Sena2026**onbase'),
                            rule: 'Selección explícita de usuario (Subdirección)'
                        };
                    }
                    return {
                        depKey: 'custom',
                        depName: 'Usuario Personalizado',
                        depCode: 'N/A',
                        username: target_user,
                        password: password || getP(orgSub, 'Sena2026**onbase'),
                        rule: `Usuario explícito: ${target_user}`
                    };
                }

                if (!doc) {
                    return {
                        depKey: '9224',
                        depName: orgSub.section_name || 'Subdirección de Centro',
                        depCode: '9224',
                        username: username || getU(orgSub, 'TVILLAMIZARJ'),
                        password: password || getP(orgSub, 'Sena2026**onbase'),
                        rule: 'General / Sin documento'
                    };
                }

                // Detección automática por códigos TRD (Serie, Subserie, Código Expediente o Nombre de Archivo)
                const text = `${doc.subserie || ''} ${doc.subseries_code || ''} ${doc.series_code || ''} ${doc.expediente_code || ''} ${doc.filename || ''}`.toUpperCase();

                if (text.includes('9224.4') || text.includes('68.9224.4') || doc.organization_id === 8 || doc.series_dep_id === 8) {
                    return {
                        depKey: '9224.4',
                        depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                        depCode: '9224.4',
                        username: getU(orgForm, 'EDHERNANDEZM'),
                        password: getP(orgForm, 'Sena2026**onbase'),
                        rule: 'TRD 9224.4 (Formación Profesional Integral)'
                    };
                }

                if (text.includes('9224.2') || text.includes('68.9224.2') || doc.organization_id === 7 || doc.series_dep_id === 7) {
                    return {
                        depKey: '9224.2',
                        depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                        depCode: '9224.2',
                        username: getU(orgAdmin, 'luepitar'),
                        password: getP(orgAdmin, 'Automatizador2026*'),
                        rule: 'TRD 9224.2 (Administración Educativa)'
                    };
                }

                if (text.includes('68.9224-') || text.includes('9224-') || text.includes('68.9224/') || doc.organization_id === 6 || doc.series_dep_id === 6) {
                    return {
                        depKey: '9224',
                        depName: orgSub.section_name || 'Subdirección de Centro',
                        depCode: '9224',
                        username: getU(orgSub, 'TVILLAMIZARJ'),
                        password: getP(orgSub, 'Sena2026**onbase'),
                        rule: 'TRD 9224 (Subdirección de Centro)'
                    };
                }

                // Detección por usuario en sesión (si no es admin)
                if (req.user && req.user.organization_id === 8) {
                    return {
                        depKey: '9224.4',
                        depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                        depCode: '9224.4',
                        username: getU(orgForm, 'EDHERNANDEZM'),
                        password: getP(orgForm, 'Sena2026**onbase'),
                        rule: 'Dependencia del Usuario (Formación)'
                    };
                }
                if (req.user && req.user.organization_id === 7) {
                    return {
                        depKey: '9224.2',
                        depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                        depCode: '9224.2',
                        username: getU(orgAdmin, 'luepitar'),
                        password: getP(orgAdmin, 'Automatizador2026*'),
                        rule: 'Dependencia del Usuario (Adm. Educativa)'
                    };
                }

                // Fallback por defecto: Subdirección
                return {
                    depKey: '9224',
                    depName: orgSub.section_name || 'Subdirección de Centro',
                    depCode: '9224',
                    username: username || getU(orgSub, 'TVILLAMIZARJ'),
                    password: password || getP(orgSub, 'Sena2026**onbase'),
                    rule: 'Fallback General (Subdirección)'
                };
            };

            // Agrupar documentos por dependencia
            const depBatches = [];
            if (docsToProcess.length > 0) {
                const groupMap = new Map();
                for (const doc of docsToProcess) {
                    const creds = resolveDocCreds(doc);
                    if (!groupMap.has(creds.depKey)) {
                        groupMap.set(creds.depKey, {
                            ...creds,
                            docs: []
                        });
                    }
                    groupMap.get(creds.depKey).docs.push(doc);
                }
                for (const b of groupMap.values()) {
                    depBatches.push(b);
                }
            } else {
                const defaultCreds = resolveDocCreds(null);
                depBatches.push({
                    ...defaultCreds,
                    docs: []
                });
            }

            // Ejecutar cada lote por dependencia
            for (let bIdx = 0; bIdx < depBatches.length; bIdx++) {
                if (!currentJob.running) break;

                const currentBatch = depBatches[bIdx];
                const batchDocs = currentBatch.docs || [];

                currentJob.logs.push(`\n==================================================`);
                currentJob.logs.push(`[LOTE ${bIdx + 1}/${depBatches.length}] 🏢 Dependencia TRD: ${currentBatch.depName} (${currentBatch.depCode})`);
                currentJob.logs.push(`[LOTE ${bIdx + 1}/${depBatches.length}] 🔑 Usuario OnBase: "${currentBatch.username}" | Criterio: ${currentBatch.rule}`);
                currentJob.logs.push(`[LOTE ${bIdx + 1}/${depBatches.length}] 📄 Documentos a procesar: ${batchDocs.length}`);
                currentJob.logs.push(`==================================================`);

                // ── PASO 1: LOGIN POR DEPENDENCIA ──
                currentJob.currentStep = `PASO 1: Login (${currentBatch.username})`;
                const loginOk = await paso1_login(page, url, currentBatch.username, currentBatch.password, currentJob.logs);
                if (!loginOk) {
                    currentJob.logs.push(`[ERROR] Login fallido con el usuario "${currentBatch.username}".`);
                    if (depBatches.length === 1) {
                        const ss = await page.screenshot().catch(() => null);
                        if (activeBrowser) {
                            await activeBrowser.close().catch(() => {});
                            activeBrowser = null;
                            activePage = null;
                        }
                        currentJob.running = false;
                        currentJob.completed = true;
                        currentJob.error = `Login fallido con usuario ${currentBatch.username}. Verifique credenciales en Configuración AES.`;
                        currentJob.screenshot = ss ? `data:image/png;base64,${ss.toString('base64')}` : null;
                        automationEmitter.emit('done', currentJob);
                        return;
                    } else {
                        currentJob.logs.push(`[WARN] Saltando lote de ${currentBatch.username} por fallo en login, continuando con siguientes...`);
                        continue;
                    }
                }

                // ── SI ES MÓDULO DE DESERCIONES ──
                if (action === 'deserciones_onbase_cargue' || stop_at_step === 3) {
                    currentJob.currentStep = 'PASO 3: Selección de UForm Comunicación Electrónica';
                    currentJob.logs.push('[DESERCIONES] Abriendo "COMUNICACIONES PRODUCIDAS" -> "UForm Comunicacion Electronica"...');
                    
                    await paso3_uformComunicacionElectronica(page, browser, currentJob.logs);
                    
                    if (stop_at_step === 3) {
                        currentJob.logs.push(`[INFO] ✅ Formulario "UForm Comunicación Electrónica" cargado exitosamente en pantalla. Robot listo en Paso 3.`);
                        currentJob.running = false;
                        currentJob.completed = true;
                        automationEmitter.emit('done', currentJob);
                        return;
                    }

                    // ── PASO 4: DILIGENCIAR Y ENVIAR FORMULARIO DE COMUNICACIÓN ──
                    currentJob.currentStep = 'PASO 4: Diligenciamiento de Formulario de Comunicación';
                    let casosToLoad = [];

                    if (req.body.casos_data && Array.isArray(req.body.casos_data) && req.body.casos_data.length > 0) {
                        casosToLoad = req.body.casos_data;
                    } else if (caso_ids && Array.isArray(caso_ids) && caso_ids.length > 0) {
                        const validNumIds = caso_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                        if (validNumIds.length > 0) {
                            const placeholders = validNumIds.map((_, i) => `$${i + 1}`).join(',');
                            const qRes = await pool.query(`SELECT * FROM deserciones_casos WHERE id IN (${placeholders})`, validNumIds).catch(() => ({ rows: [] }));
                            casosToLoad = qRes.rows || [];
                        }
                    }

                    if (casosToLoad.length === 0) {
                        const qRes = await pool.query(`SELECT * FROM deserciones_casos WHERE status = 'Pendiente' ORDER BY id ASC LIMIT 50`).catch(() => ({ rows: [] }));
                        casosToLoad = qRes.rows || [];
                    }

                    // Fallback para pruebas o demos si no hay datos de casos provistos
                    if (casosToLoad.length === 0) {
                        casosToLoad = [{
                            id: 1,
                            aprendiz_nombre: 'MANUEL VALENCIA SANCHEZ',
                            aprendiz_correo: 'manuel.valencia@sena.edu.co',
                            asunto: 'NOVEDADES DE ALUMNOS',
                            descripcion_asunto: 'Notificación de Deserción de Aprendiz',
                            texto_combinado: 'Por medio del presente documento se notifica el inicio del trámite de deserción correspondiente.'
                        }];
                    }
                        currentJob.logs.push(`[DESERCIONES] Procesando ${casosToLoad.length} caso(s) de deserción para cargue completo en OnBase...`);

                        for (let cIdx = 0; cIdx < casosToLoad.length; cIdx++) {
                            if (!currentJob.running) break;
                            const casoItem = casosToLoad[cIdx];
                            currentJob.logs.push(`\n==================================================`);
                            currentJob.logs.push(`[DESERCIONES Caso ${cIdx + 1}/${casosToLoad.length}] Aprendiz: ${casoItem.aprendiz_nombre} (Doc: ${casoItem.aprendiz_doc_numero})`);
                            currentJob.logs.push(`==================================================`);

                            let casoOk = false;
                            const maxAttempts = 2;

                            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                try {
                                    if (cIdx > 0 || attempt > 1) {
                                        await paso3_uformComunicacionElectronica(page, browser, currentJob.logs);
                                        await wait(1000);
                                    }

                                    const isSoloDiligenciar = !!req.body.solo_diligenciar;
                                    await paso4_diligenciarComunicacionElectronica(page, browser, casoItem, currentJob.logs, { solo_diligenciar: isSoloDiligenciar });

                                    await pool.query(`UPDATE deserciones_casos SET status = 'Cargado', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [casoItem.id]).catch(() => {});
                                    currentJob.logs.push(`[DESERCIONES Caso ${cIdx + 1}/${casosToLoad.length}] ✅ Caso #${casoItem.id} radicado y actualizado a 'Cargado' en BD.`);
                                    casoOk = true;
                                    break;
                                } catch (caseErr) {
                                    currentJob.logs.push(`[DESERCIONES Caso ${cIdx + 1}] ⚠️ Intento ${attempt}/${maxAttempts} falló: ${caseErr.message}`);
                                    await checkAndClearLocks(browser, currentJob.logs).catch(() => {});
                                    if (attempt < maxAttempts) {
                                        currentJob.logs.push(`[DESERCIONES Caso ${cIdx + 1}] 🔄 Reintentando en 3 segundos...`);
                                        await wait(3000);
                                    } else {
                                        // Capturar screenshot de evidencia del error
                                        let errorScreenPath = null;
                                        try {
                                            const errDir = path.join(__dirname, '..', 'uploads', 'deserciones', 'errors');
                                            if (!fs.existsSync(errDir)) fs.mkdirSync(errDir, { recursive: true });
                                            const errFileName = `error_caso_${casoItem.id}_${Date.now()}.png`;
                                            const fullErrPath = path.join(errDir, errFileName);
                                            await page.screenshot({ path: fullErrPath, fullPage: false });
                                            errorScreenPath = `/uploads/deserciones/errors/${errFileName}`;
                                            currentJob.logs.push(`[DESERCIONES Caso ${cIdx + 1}] 📸 Captura de evidencia guardada: ${errFileName}`);
                                        } catch (screenErr) {
                                            console.warn('[DESERCIONES] Error tomando screenshot de fallo:', screenErr.message);
                                        }

                                        const errNote = `Error: ${caseErr.message}${errorScreenPath ? ` | Captura: ${errorScreenPath}` : ''}`;
                                        await pool.query(
                                            `UPDATE deserciones_casos SET status = 'Error', descripcion_asunto = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                                            [casoItem.id, errNote]
                                        ).catch(() => {});
                                    }
                                }
                            }
                        }

                    currentJob.running = false;
                    currentJob.completed = true;
                    currentJob.logs.push(`\n[DESERCIONES] ✅ Proceso de lote a OnBase Web finalizado para ${casosToLoad.length} caso(s).`);
                    automationEmitter.emit('done', currentJob);
                    return;
                }

                // ── PROCESAR DOCUMENTOS DEL LOTE ──
                const totalDocs = Math.max(1, batchDocs.length);
                for (let docIdx = 0; docIdx < totalDocs; docIdx++) {
                    if (!currentJob.running) {
                        currentJob.logs.push('[INFO] Automatización cancelada por el usuario.');
                        break;
                    }

                    const docInfo = batchDocs[docIdx] || null;
                    const hasMoreDocs = docIdx < totalDocs - 1;

                    if (docInfo) {
                        currentJob.logs.push(`\n--------------------------------------------------`);
                        currentJob.logs.push(`[LOTE ${bIdx + 1}] Documento ${docIdx + 1} de ${totalDocs}: "${docInfo.filename}"`);
                        currentJob.logs.push(`--------------------------------------------------`);
                    }

                    const maxDocAttempts = 2;
                    let docSuccess = false;

                    for (let attempt = 1; attempt <= maxDocAttempts; attempt++) {
                        try {
                            if (attempt > 1) {
                                currentJob.logs.push(`[Doc ${docIdx + 1}/${totalDocs}] 🔄 Reintentando documento (intento ${attempt}/${maxDocAttempts})...`);
                                await checkAndClearLocks(browser, currentJob.logs).catch(() => {});
                                await wait(2000);
                            }

                            // ── PASO 2: FORMULARIO SGDEA (Siempre abrir un nuevo formulario limpio para cada documento del lote) ──
                            currentJob.currentStep = `[Doc ${docIdx + 1}/${totalDocs}] PASO 2: Formulario SGDEA`;
                            await paso2_abrirFormulario(page, browser, currentJob.logs);
                            await wait(1500);

                            // ── PASO 3: CÓDIGO DE EXPEDIENTE ──
                            currentJob.currentStep = `[Doc ${docIdx + 1}/${totalDocs}] PASO 3: Código de Expediente`;
                            let formPage = page;
                            let formFrame = page.mainFrame();

                            if (docInfo?.expediente_code) {
                                let result = await paso3_codigoExpediente(
                                    page, browser, docInfo.expediente_code, currentJob.logs
                                );

                                if ((!result || !result.success) && docIdx > 0) {
                                    currentJob.logs.push(`[Doc ${docIdx + 1}/${totalDocs}] [FALLBACK] Campo "Código Expediente" no detectado. Re-ejecutando PASO 2 para asegurar formulario...`);
                                    await paso2_abrirFormulario(page, browser, currentJob.logs);
                                    await wait(1500);
                                    result = await paso3_codigoExpediente(
                                        page, browser, docInfo.expediente_code, currentJob.logs
                                    );
                                }

                                if (!result || !result.success) {
                                    throw new Error("No se pudo escribir el Código de Expediente o no se encontró el campo.");
                                }

                                if (result?.formPage) formPage = result.formPage;
                                if (result?.formFrame) formFrame = result.formFrame;
                            }

                            // ── PASO 4: LLENAR CAMPOS ──
                            currentJob.currentStep = `[Doc ${docIdx + 1}/${totalDocs}] PASO 4: Llenar Campos`;
                            if (docInfo) {
                                await paso4_llenarCampos(formPage, formFrame, docInfo, currentJob.logs);
                            }
                            await wait(500);

                            // ── PASO 5: ADJUNTAR PDF ──
                            currentJob.currentStep = `[Doc ${docIdx + 1}/${totalDocs}] PASO 5: Adjuntar PDF`;
                            if (docInfo?.path) {
                                const attachOk = await paso5_adjuntarPDF(page, allFrames, docInfo, currentJob.logs);
                                if (!attachOk) {
                                    throw new Error("Fallo al adjuntar el archivo PDF (Importar falló o archivo no encontrado).");
                                }
                            }

                            // ── PASO 6: GUARDAR ──
                            currentJob.currentStep = `[Doc ${docIdx + 1}/${totalDocs}] PASO 6: Guardar`;
                            const saveOk = await paso6_guardar(page, allFrames, currentJob.logs, hasMoreDocs);
                            if (!saveOk) {
                                throw new Error("El guardado falló o el botón Guardar no estuvo disponible.");
                            }

                            // Marcar documento como Cargado en la BD
                            if (docInfo?.id) {
                                await new Promise(resolve => {
                                    db.run(
                                        'UPDATE documents SET status = ?, load_date = ? WHERE id = ?',
                                        ['Cargado', new Date().toISOString(), docInfo.id],
                                        () => resolve()
                                    );
                                });
                                currentJob.logs.push(`[INFO] ✅ Documento "${docInfo.filename}" (ID ${docInfo.id}) actualizado a "Cargado" en BD`);
                            }

                            docSuccess = true;
                            break;

                        } catch (docErr) {
                            currentJob.logs.push(`[ERROR DOC ${docIdx + 1}] (Intento ${attempt}/${maxDocAttempts}) "${docInfo?.filename || 'doc'}": ${docErr.message}`);
                            await checkAndClearLocks(browser, currentJob.logs).catch(() => {});
                            if (attempt === maxDocAttempts) {
                                try {
                                    const errDir = path.join(__dirname, '..', 'uploads', 'errors');
                                    if (!fs.existsSync(errDir)) fs.mkdirSync(errDir, { recursive: true });
                                    const errFile = `error_doc_${docInfo?.id || Date.now()}_${Date.now()}.png`;
                                    await page.screenshot({ path: path.join(errDir, errFile), fullPage: false }).catch(() => {});
                                    currentJob.logs.push(`[ERROR DOC ${docIdx + 1}] 📸 Captura de evidencia guardada: ${errFile}`);
                                } catch (e) {}
                            } else {
                                await wait(2500);
                            }
                        }
                    }

                    if (hasMoreDocs) {
                        await wait(2000);
                    }
                }

                // Si viene otro lote de otra dependencia diferente, cerrar sesión limpiamente
                if (bIdx < depBatches.length - 1) {
                    currentJob.logs.push(`[INFO] 🔄 Finalizado lote de "${currentBatch.username}". Cerrando sesión para cambiar a la siguiente dependencia...`);
                    await paso7_logout(page, allFrames, currentJob.logs);
                    await wait(3000);
                }
            }

            // ── PASO 7: CERRAR SESIÓN FINAL ──
            currentJob.currentStep = 'PASO 7: Cerrar Sesión final';
            await paso7_logout(page, allFrames, currentJob.logs);

            const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);

            currentJob.screenshot = screenshotBuffer ? `data:image/png;base64,${screenshotBuffer.toString('base64')}` : null;
            currentJob.logs.push('Proceso de cargue completado.');

        } catch (err) {
            currentJob.error = err.message;
            currentJob.logs.push(`[ERROR CRÍTICO] ${err.message}`);
        } finally {
            if (activeBrowser) {
                await activeBrowser.close().catch(() => {});
                activeBrowser = null;
                activePage = null;
            }
            currentJob.running = false;
            currentJob.completed = true;
            automationEmitter.emit('done', currentJob);
        }
    })().catch(unhandledErr => {
        console.error('[AUTOMATION UNHANDLED PROMISE ERROR]', unhandledErr);
        if (activeBrowser) {
            activeBrowser.close().catch(() => {});
            activeBrowser = null;
            activePage = null;
        }
        currentJob.running = false;
        currentJob.completed = true;
        currentJob.error = unhandledErr.message;
        currentJob.logs.push(`[ERROR CRÍTICO INESPERADO] ${unhandledErr.message}`);
        automationEmitter.emit('done', currentJob);
    });
    } catch (routeErr) {
        console.error('[EXECUTE AUTOMATION ROUTE ERROR]', routeErr);
        return res.status(500).json({
            success: false,
            error: routeErr.message || 'Error interno al iniciar la automatización'
        });
    }
};

// ─────────────────────────────────────────────────────────────────
// STREAMING DE FRAMES (pantalla en tiempo real en el frontend)
// ─────────────────────────────────────────────────────────────────
exports.streamAutomation = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none'
    });
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    res.write(': sse connected\n\n');

    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch (e) {
            clearInterval(heartbeat);
        }
    }, 4000);

    const sendFrame = data => {
        try {
            res.write(`data: ${data}\n\n`);
        } catch (e) { }
    };

    automationEmitter.on('frame', sendFrame);

    req.on('close', () => {
        clearInterval(heartbeat);
        automationEmitter.removeListener('frame', sendFrame);
    });
};

// ─────────────────────────────────────────────────────────────────
// UNITY AUTOMATION (sin cambios)
// ─────────────────────────────────────────────────────────────────
exports.executeUnityAutomation = async (req, res) => {
    const { action } = req.body;
    const logs = [`[UNITY] Iniciando: ${action}`];
    try {
        exec(`powershell -Command "Get-Process 'OnBase' -ErrorAction SilentlyContinue"`,
            (error, stdout) => {
                if (error) return res.status(500).json({ error: error.message, logs });
                logs.push(`[UNITY] ${stdout.trim()}`);
                res.json({ message: 'Comando enviado', logs });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message, logs });
    }
};

// ─────────────────────────────────────────────────────────────────
// DIAGNÓSTICO: inspeccionar el formulario real de OnBase
// Llama: POST /api/automation/diagnostic  { url, username, password }
// Devuelve la estructura HTML real del formulario para ajustar el robot
// ─────────────────────────────────────────────────────────────────
exports.executeDiagnostic = async (req, res) => {
    const { url, username, password } = req.body;
    const logs = [];

    if (!url || !username || !password) {
        return res.status(400).json({ error: 'Faltan: url, username, password' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: process.platform === 'linux' ? true : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 900 });

        // PASO 1: Login
        const loginOk = await paso1_login(page, url, username, password, logs);
        if (!loginOk) {
            await browser.close();
            return res.status(500).json({ error: 'Login fallido', logs });
        }

        // PASO 2: Abrir formulario SGDEA
        await paso2_abrirFormulario(page, browser, logs);
        await wait(5000); // Esperar que el formulario cargue completamente

        // DIAGNÓSTICO: capturar estructura completa de TODOS los frames
        const diagnostico = {
            url_actual: page.url(),
            paginas: [],
            logs
        };

        const allPages = await browser.pages();
        for (const pg of allPages) {
            const pgData = { url: pg.url(), frames: [] };
            for (const frame of pg.frames()) {
                try {
                    const frameData = await frame.evaluate(() => {
                        // Todos los inputs
                        const inputs = Array.from(document.querySelectorAll(
                            'input, textarea, select'
                        )).map(el => ({
                            tag: el.tagName.toLowerCase(),
                            type: el.type || '',
                            id: el.id || '',
                            name: el.name || '',
                            title: el.title || '',
                            placeholder: el.placeholder || '',
                            value: el.value ? el.value.substring(0, 50) : '',
                            readOnly: el.readOnly || el.disabled || false,
                            className: el.className ? el.className.substring(0, 60) : '',
                            // Texto del TR contenedor
                            rowText: ((el.closest('tr') || el.closest('td') || el.parentElement || {})
                                .innerText || '').trim().substring(0, 100),
                        }));

                        // Todos los botones
                        const btns = Array.from(document.querySelectorAll(
                            'button, input[type="button"], input[type="submit"], a[role="button"]'
                        )).filter(b => b.offsetParent !== null).map(b => ({
                            tag: b.tagName.toLowerCase(),
                            text: (b.innerText || b.value || '').trim().substring(0, 60),
                            id: b.id || '',
                            className: b.className ? b.className.substring(0, 60) : ''
                        }));

                        // Labels visibles en el formulario
                        const labels = Array.from(document.querySelectorAll(
                            'label, td, th, span[class*="label" i], div[class*="label" i]'
                        )).filter(el => {
                            const t = (el.innerText || el.textContent || '').trim();
                            return t.length > 1 && t.length < 80 && el.offsetParent !== null;
                        }).map(el => (el.innerText || '').trim()).filter(Boolean).slice(0, 30);

                        return {
                            url: window.location.href,
                            title: document.title,
                            inputs: inputs.slice(0, 20),
                            buttons: btns.slice(0, 15),
                            labels: [...new Set(labels)].slice(0, 25),
                            totalInputs: inputs.length,
                            totalBtns: btns.length
                        };
                    }).catch(() => null);

                    if (frameData && (frameData.totalInputs > 0 || frameData.totalBtns > 0)) {
                        pgData.frames.push(frameData);
                        logs.push(`[DIAG] Frame: ${frameData.url.substring(0, 60)} → ${frameData.totalInputs} inputs, ${frameData.totalBtns} botones`);
                        logs.push(`[DIAG] Labels: ${frameData.labels.join(' | ')}`);
                        frameData.inputs.forEach(inp =>
                            logs.push(`[DIAG]   [${inp.tag}][${inp.type || 'select'}] id="${inp.id}" name="${inp.name}" title="${inp.title}" rowText="${inp.rowText.substring(0, 60)}"`)
                        );
                    }
                } catch { }
            }
            if (pgData.frames.length > 0) diagnostico.paginas.push(pgData);
        }

        // Screenshot del estado actual
        const ss = await page.screenshot().catch(() => null);
        await browser.close();

        return res.json({
            ...diagnostico,
            screenshot: ss ? `data:image/png;base64,${ss.toString('base64')}` : null
        });

    } catch (err) {
        if (browser) await browser.close().catch(() => { });
        return res.status(500).json({ error: err.message, logs });
    }
};

// ─────────────────────────────────────────────────────────────────
// UNITY ROBOT: Comunicaciones Producidas
// ─────────────────────────────────────────────────────────────────
/**
 * POST /api/automation/unity-robot
 * Body: {
 *   file_path: string,          // ruta absoluta al PDF
 *   nis?: string,
 *   radicado_compuesto?: string,
 *   asunto?: string,
 *   descripcion_asunto?: string,
 *   medio_ingreso?: string,      // 'FISICO' | 'E-MAIL' (default: 'FISICO')
 *   entrega_mano?: string,       // 'SI' | 'NO' (default: 'NO')
 *   num_anexos?: string,
 *   descripcion_anexos?: string,
 *   tipo_documento?: string,     // default: '01-Comunicacion Producida (PAPEL)'
 * }
 */
exports.runUnityRobot = async (req, res) => {
    const params = req.body || {};
    const logs = [];

    if (!params.file_path) {
        return res.status(400).json({ success: false, error: 'file_path requerido', logs });
    }

    const scriptPath = path.join(__dirname, '..', 'scripts', 'unity_robot.py');
    const paramsJson = JSON.stringify(params).replace(/"/g, '\\"');
    const cmd = `python "${scriptPath}" "${paramsJson}"`;

    logs.push(`[UNITY-ROBOT] Ejecutando: ${cmd}`);

    return new Promise((resolve) => {
        exec(cmd, { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            output.split('\n').forEach(line => { if (line.trim()) logs.push(line.trim()); });

            if (err) {
                logs.push(`[UNITY-ROBOT][ERROR] ${err.message}`);
                resolve(res.status(500).json({ success: false, error: err.message, logs }));
            } else {
                logs.push('[UNITY-ROBOT] ✅ Script completado exitosamente');
                resolve(res.json({ success: true, logs }));
            }
        });
    });
};

exports.getPM2Logs = async (req, res) => {
    if (req.query.secret !== 'Aut0m4t1z4d0r2026%*') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const errorLogPath = '/home/cimi/.pm2/logs/sena-backend-error.log';
        const outLogPath = '/home/cimi/.pm2/logs/sena-backend-out.log';
        
        let errorLog = 'No error log found';
        let outLog = 'No out log found';
        
        if (fs.existsSync(errorLogPath)) {
            const stats = fs.statSync(errorLogPath);
            const fd = fs.openSync(errorLogPath, 'r');
            const bufferSize = Math.min(stats.size, 50000);
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            errorLog = buffer.toString('utf8');
        }
        
        if (fs.existsSync(outLogPath)) {
            const stats = fs.statSync(outLogPath);
            const fd = fs.openSync(outLogPath, 'r');
            const bufferSize = Math.min(stats.size, 50000);
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            outLog = buffer.toString('utf8');
        }
        
        return res.json({
            success: true,
            errorLog: errorLog.split('\n').slice(-150).join('\n'),
            outLog: outLog.split('\n').slice(-150).join('\n')
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// CONTROLES DE INTERACCIÓN MANUAL (PARA SOPORTE DE USUARIO)
// ─────────────────────────────────────────────────────────────────
exports.clickActivePage = async (req, res) => {
    const { x, y, clickCount = 1, button = 'left' } = req.body;
    if (!activePage) {
        return res.status(400).json({ error: 'No hay ninguna sesión de automatización activa' });
    }
    try {
        const nx = Number(x);
        const ny = Number(y);
        console.log(`[MANUAL-CLICK] Clic (${clickCount}x ${button}) en x: ${nx}, y: ${ny}`);
        await activePage.mouse.move(nx, ny);
        await wait(50);
        await activePage.mouse.click(nx, ny, { clickCount: Number(clickCount), delay: 80, button });
        return res.json({ success: true, message: `Clic ejecutado en x: ${nx}, y: ${ny}` });
    } catch (err) {
        console.error('[MANUAL-CLICK] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

exports.typeActivePage = async (req, res) => {
    const { text } = req.body;
    if (!activePage) {
        return res.status(400).json({ error: 'No hay ninguna sesión de automatización activa' });
    }
    try {
        console.log(`[MANUAL-TYPE] Escribiendo texto: "${text}"`);
        await activePage.keyboard.type(text, { delay: 30 });
        return res.json({ success: true, message: `Texto escrito correctamente` });
    } catch (err) {
        console.error('[MANUAL-TYPE] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

exports.pressKeyActivePage = async (req, res) => {
    const { key } = req.body;
    if (!activePage) {
        return res.status(400).json({ error: 'No hay ninguna sesión de automatización activa' });
    }
    try {
        console.log(`[MANUAL-KEY] Presionando tecla: ${key}`);
        await activePage.keyboard.press(key);
        return res.json({ success: true, message: `Tecla ${key} presionada` });
    } catch (err) {
        console.error('[MANUAL-KEY] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

exports.killActiveAutomation = async (req, res) => {
    if (!activeBrowser) {
        return res.status(400).json({ error: 'No hay ninguna sesión de automatización activa' });
    }
    try {
        console.log(`[MANUAL-KILL] Cerrando sesión y navegador por solicitud de usuario...`);
        await activeBrowser.close();
        activeBrowser = null;
        activePage = null;
        return res.json({ success: true, message: `Sesión de automatización terminada` });
    } catch (err) {
        console.error('[MANUAL-KILL] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};






