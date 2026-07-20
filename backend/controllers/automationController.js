const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const EventEmitter = require('events');
const db = require('../database');

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

// ─────────────────────────────────────────────────────────────────
// PASO 1: LOGIN
// ─────────────────────────────────────────────────────────────────
async function paso1_login(page, url, username, password, logs) {
    logs.push('[PASO 1] Navegando a OnBase...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        .catch(e => logs.push(`[PASO 1][WARN] goto: ${e.message}`));
    await wait(3000);

    // Detectar si estamos en Microsoft SSO
    const isMicrosoftSSO = await page.evaluate(() => {
        return window.location.href.includes('microsoftonline.com') || 
               document.title.includes('Iniciar sesión') || 
               document.title.includes('Sign in') || 
               !!document.querySelector('input[name="loginfmt"]');
    });

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
        const staySignedIn = await page.evaluate(() => {
            const hasStayText = document.body.innerText.includes('mantener la sesión') || 
                                document.body.innerText.includes('Stay signed in');
            const hasNoBtn = !!document.querySelector('#idBtn_Back');
            return hasStayText && hasNoBtn;
        });
        
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

    for (let t = 0; t < 24 && !dropdownHandled; t++) {
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
    return { formPage, formFrame };
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

            logs.push(`[PASO 4] Escribiendo en ${fieldName}: "${valueToType.substring(0,40)}"`);
            for (const char of valueToType) {
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

                                const suggestion = await frame.evaluate((sels, sc) => {
                                    for (const sel of sels) {
                                        const items = Array.from(document.querySelectorAll(sel)).filter(el => {
                                            const r = el.getBoundingClientRect();
                                            return r.width > 0 && r.height > 0;
                                        });
                                        if (items.length > 0) {
                                            const cleanText = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                                            const searchText = cleanText(sc);
                                            // 1. Intentar coincidencia exacta tras limpiar acentos y espacios
                                            let exact = items.find(i => cleanText(i.innerText || i.textContent) === searchText);
                                            // 2. Reintento con includes tras limpiar si no hay coincidencia exacta
                                            if (!exact) {
                                                exact = items.find(i => cleanText(i.innerText || i.textContent).includes(searchText));
                                            }
                                            const target = exact || items[0];
                                            const r = target.getBoundingClientRect();
                                            return {
                                                lx: r.left + r.width / 2,
                                                ly: r.top + r.height / 2,
                                                text: (target.innerText || target.textContent || '').trim().substring(0, 80)
                                            };
                                        }
                                    }
                                    return null;
                                }, DROPDOWN_SELS, valueToType);

                                if (suggestion) {
                                    logs.push(`[PASO 4] ✅ Dropdown detectado para ${fieldName} → "${suggestion.text}"`);
                                    await pg.mouse.click(offX + suggestion.lx, offY + suggestion.ly);
                                    await wait(1500); // Tiempo para autorrelleno
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
async function paso6_guardar(page, allFramesFn, logs) {
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
    logs.push('[PASO 6] Esperando diálogo post-guardado (ej. "Would you like to complete another form?")...');
    let dialogHandled = false;
    for (let t = 0; t < 25 && !dialogHandled; t++) {
        await wait(500);
        for (const frame of allFramesFn()) {
            try {
                dialogHandled = await frame.evaluate(() => {
                    const candidates = Array.from(document.querySelectorAll('button, a, input, div, span, td, [role="button"]'));
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
                    return false;
                });
                if (dialogHandled) {
                    logs.push(`[PASO 6] ✅ Diálogo post-guardado detectado e interactuado en t=${(t * 0.5).toFixed(1)}s`);
                    break;
                }
            } catch (e) { }
        }
    }

    if (!dialogHandled) {
        logs.push('[PASO 6][WARN] Diálogo post-guardado ("Sí"/"Yes") no detectado. Continuando...');
    }

    await wait(3000);
    logs.push('[PASO 6] ✅ Proceso completado');
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
exports.executeAutomation = async (req, res) => {
    const { url, username, password, documentId } = req.body;
    const logs = [];
    let currentStep = 'Iniciando';

    // Obtener info del documento
    let docInfo = null;
    if (documentId) {
        try {
            docInfo = await new Promise((resolve, reject) => {
                const q = `
                    SELECT d.*, d.storage_path, e.expediente_code, e.title as expediente_title,
                           e.metadata_values as expediente_metadata
                    FROM documents d
                    LEFT JOIN expedientes e ON d.expediente_id = e.id
                    WHERE d.id = ?`;
                db.get(q, [documentId], (err, row) => {
                    if (err) reject(err); else if (!row) reject(new Error('Document not found')); else resolve(row);
                });
            });

            let meta = {};
            try { meta = JSON.parse(docInfo.expediente_metadata || '{}'); } catch { }
            // El nombre del documento concatena los metadatos con '_' como separador
            // (confirmado en video: "NINI JOHANNA CAICEDO CAICEDO_NO INDICADO 00 72025002358")
            const metaJoined = [1, 2, 3, 4, 5, 6, 7, 8]
                .map(i => meta[`valor${i}`] || meta[`Metadato ${i}`])
                .filter(Boolean).join('_');
            docInfo.nombreDocumento = docInfo.expediente_title || metaJoined || docInfo.filename;

            // Si el documento tiene descripción en sus metadatos (texto condicional), se anexa al final con un espacio
            let docMeta = {};
            try { if (docInfo.metadata_values) docMeta = JSON.parse(docInfo.metadata_values); } catch (e) { }
            if (docMeta && docMeta.description) {
                docInfo.nombreDocumento = `${docInfo.nombreDocumento.trim()} ${docMeta.description.trim()}`;
            }

            docInfo.joinedName = docInfo.nombreDocumento;
            docInfo.parsedMeta = meta;

            logs.push(`[INFO] Documento: ${docInfo.filename}`);
            logs.push(`[INFO] Expediente: ${docInfo.expediente_code || 'Sin código'}`);
            logs.push(`[INFO] Tipología: ${docInfo.typology_name}`);
        } catch (e) {
            logs.push(`[WARN] Info documento: ${e.message}`);
        }
    }
    
    logs.push(`[DEBUG] docInfo actual: ${JSON.stringify(docInfo)}`);

    if (!url) return res.status(400).json({ error: 'URL de OnBase requerida' });

    let browser;

    const automationPromise = (async () => {
        try {
            activeBrowser = await puppeteer.launch({
                headless: process.platform === 'linux' ? true : false,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            browser = activeBrowser;

            activePage = await activeBrowser.newPage();
            const page = activePage;
            await page.setViewport({ width: 1366, height: 900 });

            // Screencast en tiempo real
            try {
                const session = await page.target().createCDPSession();
                await session.send('Page.startScreencast', { format: 'jpeg', quality: 65 });
                session.on('Page.screencastFrame', ev => {
                    automationEmitter.emit('frame', ev.data);
                    session.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => { });
                });
            } catch { }

            const allFrames = () => page.frames();

            // ── PASO 1: LOGIN ──
            currentStep = 'PASO 1: Login';
            if (!username || !password) {
                return { statusCode: 500, data: { error: 'Credenciales no configuradas', logs } };
            }
            const loginOk = await paso1_login(page, url, username, password, logs);
            if (!loginOk) {
                const ss = await page.screenshot().catch(() => null);
                if (activeBrowser) {
                    await activeBrowser.close().catch(() => {});
                    activeBrowser = null;
                    activePage = null;
                }
                return {
                    statusCode: 500,
                    data: {
                        error: 'Login fallido. Verifique URL, usuario y contraseña en Config. AES.',
                        logs,
                        screenshot: ss ? `data:image/png;base64,${ss.toString('base64')}` : null
                    }
                };
            }

            // ── PASO 2: ABRIR FORMULARIO SGDEA ──
            currentStep = 'PASO 2: Abrir Formulario SGDEA';
            await paso2_abrirFormulario(page, browser, logs);
            await wait(2000);

            // ── PASO 3: CÓDIGO DE EXPEDIENTE ──
            currentStep = 'PASO 3: Código de Expediente';
            let formPage = page;
            let formFrame = page.mainFrame();

            if (docInfo?.expediente_code) {
                const result = await paso3_codigoExpediente(
                    page, browser, docInfo.expediente_code, logs
                );
                if (result?.formPage) formPage = result.formPage;
                if (result?.formFrame) formFrame = result.formFrame;
            }

            // ── PASO 4: LLENAR CAMPOS ──
            currentStep = 'PASO 4: Llenar Campos';
            if (docInfo) {
                await paso4_llenarCampos(formPage, formFrame, docInfo, logs);
            }
            await wait(500);

            // ── PASO 5: ADJUNTAR PDF ──
            currentStep = 'PASO 5: Adjuntar PDF';
            if (docInfo?.path) {
                await paso5_adjuntarPDF(page, allFrames, docInfo, logs);
            }

            // ── PASO 6: GUARDAR ──
            currentStep = 'PASO 6: Guardar';
            await paso6_guardar(page, allFrames, logs);

            // ── PASO 7: CERRAR SESIÓN ──
            currentStep = 'PASO 7: Cerrar Sesión';
            await paso7_logout(page, allFrames, logs);

            // Captura final
            const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);
            
            if (activeBrowser) {
                await activeBrowser.close().catch(() => {});
                activeBrowser = null;
                activePage = null;
            }

            // Marcar documento como Cargado en la BD
            if (documentId) {
                await new Promise(resolve => {
                    db.run(
                        'UPDATE documents SET status = ?, load_date = ? WHERE id = ?',
                        ['Cargado', new Date().toISOString(), documentId],
                        () => resolve()
                    );
                });
                logs.push('[INFO] Estado del documento actualizado a "Cargado" en BD');
            }

            return {
                statusCode: 200,
                data: {
                    message: 'Automatización completada',
                    screenshot: screenshotBuffer ? `data:image/png;base64,${screenshotBuffer.toString('base64')}` : null,
                    logs
                }
            };

        } catch (err) {
            if (activeBrowser) {
                await activeBrowser.close().catch(() => { });
                activeBrowser = null;
                activePage = null;
            }
            throw err;
        }
    })();

    // Timeout global de 4 minutos
    const timeout = new Promise((_, reject) =>
        setTimeout(() =>
            reject(new Error(`Timeout en paso: "${currentStep}". Verifique OnBase.`)),
            240000
        )
    );

    try {
        const result = await Promise.race([automationPromise, timeout]);
        try { fs.writeFileSync(path.join(__dirname, '../automation_run.log'), JSON.stringify(logs, null, 2), 'utf-8'); } catch(e) {}
        console.log("[AUTOMATION-LOGS] Completed:", JSON.stringify(logs, null, 2));
        if (result.statusCode === 500) return res.status(500).json(result.data);
        return res.json(result.data);
    } catch (error) {
        logs.push(`[ERROR CRÍTICO] ${error.message}`);
        try { fs.writeFileSync(path.join(__dirname, '../automation_run.log'), JSON.stringify(logs, null, 2), 'utf-8'); } catch(e) {}
        console.log("[AUTOMATION-LOGS] Failed:", JSON.stringify(logs, null, 2));
        return res.status(500).json({ error: error.message, logs });
    }
};

// ─────────────────────────────────────────────────────────────────
// STREAMING DE FRAMES (pantalla en tiempo real en el frontend)
// ─────────────────────────────────────────────────────────────────
exports.streamAutomation = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    const sendFrame = data => res.write(`data: ${data}\n\n`);
    automationEmitter.on('frame', sendFrame);
    req.on('close', () => automationEmitter.removeListener('frame', sendFrame));
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
    const { x, y } = req.body;
    if (!activePage) {
        return res.status(400).json({ error: 'No hay ninguna sesión de automatización activa' });
    }
    try {
        console.log(`[MANUAL-CLICK] Clic en x: ${x}, y: ${y}`);
        await activePage.mouse.click(Number(x), Number(y));
        return res.json({ success: true, message: `Clic ejecutado en x: ${x}, y: ${y}` });
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






