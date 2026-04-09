/**
 * PRUEBA DIRECTA — Robot Cargue AES
 * ===================================
 * Lanza el robot directamente sin necesitar el servidor HTTP corriendo.
 * 1) Busca un documento Pendiente en la BD
 * 2) Llama al controlador de automatización directamente
 *
 * Uso:
 *   node test_aes_robot.js              <- usa el primer documento Pendiente
 *   node test_aes_robot.js <documentId> <- usa un documento específico
 *
 * Requisitos: PostgreSQL corriendo en localhost con sena_db
 */

require('dotenv').config();

const { Pool }  = require('pg');
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

// ── Configuración ─────────────────────────────────────────────────────────────
const ONBASE_URL  = 'https://onbase.sena.edu.co/Onbase/Login.aspx';
const USERNAME    = 'JRROZO';        // ← usuario OnBase real
const PASSWORD    = 'Sena2025**';   // ← clave OnBase real
const TIPOLOGIA   = 'SGDEA - Ingreso a Expediente'; // tipología del formulario AES
const TYPE_DELAY  = 130; // ms entre teclas al escribir el código

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'sena_db',
    password: process.env.DB_PASSWORD || 'admin123',
    port:     parseInt(process.env.DB_PORT || '5432'),
});

// ── Selectores ────────────────────────────────────────────────────────────────
const INPUT_SEL = [
    'input[title*="xpediente" i]',
    'input[title*="digo" i]',
    'input[name*="xpediente" i]',
    'input[type="text"]:not([readonly])',
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([readonly])',
].join(', ');

const DROPDOWN_SELS = [
    'ul.CodeEntry_DropdownList_ItemRowList li',
    'table.AutoCompleteList td',
    '.ac_results li',
    '.ui-autocomplete li',
    '.ui-menu-item',
    '[role="option"]',
    'td[class*="autocomplete" i]',
    'div[class*="suggest" i] div',
    'li[class*="suggestion" i]',
];

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const log  = (msg) => console.log(`[${new Date().toLocaleTimeString('es-CO')}] ${msg}`);

// ── 1. Obtener documento de prueba desde BD ───────────────────────────────────
async function getDocInfo(docId) {
    const client = await pool.connect();
    try {
        let query, params;
        if (docId) {
            log(`Buscando documento ID=${docId} en BD...`);
            query  = `SELECT d.*, e.expediente_code, e.title AS expediente_title
                      FROM documents d
                      LEFT JOIN expedientes e ON d.expediente_id = e.id
                      WHERE d.id = $1`;
            params = [docId];
        } else {
            log('Buscando primer documento Pendiente con expediente_code en BD...');
            query  = `SELECT d.*, e.expediente_code, e.title AS expediente_title
                      FROM documents d
                      LEFT JOIN expedientes e ON d.expediente_id = e.id
                      WHERE d.status = 'Pendiente'
                        AND e.expediente_code IS NOT NULL
                        AND e.expediente_code != ''
                      ORDER BY d.id DESC LIMIT 1`;
            params = [];
        }
        const res = await client.query(query, params);
        if (res.rows.length === 0) {
            log('❌ No se encontró documento. Ejecuta primero: node add_test_doc.js');
            return null;
        }
        const doc = res.rows[0];
        log(`✅ Documento encontrado:`);
        log(`   ID: ${doc.id}`);
        log(`   Archivo: ${doc.filename}`);
        log(`   Expediente: ${doc.expediente_code}`);
        log(`   Tipología: ${doc.typology_name || 'SGDEA - Ingreso a Expediente'}`);
        log(`   Estado: ${doc.status}`);
        return doc;
    } finally {
        client.release();
        await pool.end();
    }
}

// ── 2. Ejecutar el robot AES ──────────────────────────────────────────────────
async function runAES(docInfo) {
    const code = docInfo.expediente_code || '';
    log(`\n=== INICIANDO ROBOT AES | Código: "${code}" ===\n`);

    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page    = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    log('ETAPA 1: Login en OnBase...');
    await page.goto(ONBASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(2000);

    // Limpiar campos y escribir credenciales
    await page.evaluate(() => {
        const u = document.querySelector('#username, input[name="username"], input[type="text"]');
        const p = document.querySelector('#password, input[name="password"], input[type="password"]');
        if (u) u.value = '';
        if (p) p.value = '';
    });
    await page.type('#username, input[name="username"], input[type="text"]', USERNAME, { delay: 80 });
    await page.type('#password, input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await page.keyboard.press('Enter');
    await wait(10000);

    const urlAfterLogin = page.url();
    log(`   URL post-login: ${urlAfterLogin.substring(0, 100)}`);

    // Login FALLIDO si la URL sigue siendo la página de login
    if (urlAfterLogin.includes('Login.aspx') || urlAfterLogin.includes('login')) {
        log('❌ Login FALLIDO — Se quedó en la página de login.');
        log('   Verifica usuario/clave: ' + USERNAME + ' / ' + PASSWORD.replace(/./g,'*'));
        await wait(5000);
        await browser.close(); return;
    }
    log('   ✅ Login exitoso — URL: ' + urlAfterLogin.substring(0, 80));

    // ── ETAPA 2: ABRIR FORMULARIO NUEVO ─────────────────────────────────────
    log('ETAPA 2: Abriendo Nuevo Formulario...');
    // El usuario llega al formulario SGDEA desde el panel izquierdo "documentos"
    // Intentamos primero el botón "Nuevo Formulario" y si no, navegamos por el árbol
    await page.evaluate(() => {
        // Intento 1: botón "nuevo formulario" estándar de OnBase
        const btn = document.querySelector('.js-navMenuButton, #newform, [title*="Nuevo" i], [title*="New" i], a[href*="newform" i]');
        if (btn) btn.click();
    });
    await wait(2000);
    await page.evaluate(() => {
        // Intento 2: buscar el botón "#newform" que aparece tras abrir el menú
        const btn = document.querySelector('#newform, [id*="newform" i], [class*="newform" i]');
        if (btn) btn.click();
    });
    await wait(3000);

    // ── ETAPA 3: SELECCIONAR TIPOLOGÍA "SGDEA - Ingreso a Expediente" ──────────
    // CRÍTICO: buscar el elemento con texto MÁS CORTO que contenga "sgdea"
    // El contenedor padre tiene texto largo (todos sus hijos), el item exacto tiene
    // solo "SGDEA - Ingreso a Expediente" (~30 caracteres)
    log(`ETAPA 3: Seleccionando tipología "${TIPOLOGIA}"...`);
    let sgdeaClicked = false;

    for (let attempt = 0; attempt < 6 && !sgdeaClicked; attempt++) {
        await wait(2000);
        const allPgs = await browser.pages();
        for (const pg of allPgs) {
            for (const fr of pg.frames()) {
                const r = await fr.evaluate(() => {
                    // Buscar TODOS los elementos clickeables que contengan "sgdea"
                    const candidates = Array.from(document.querySelectorAll(
                        'li, a, span, td, div[class*="item" i], div[class*="row" i], div[role="option"], div[role="menuitem"]'
                    )).filter(el => {
                        const t = (el.innerText || el.textContent || '').trim();
                        return t.toLowerCase().includes('sgdea') && t.length < 100;
                    });

                    if (candidates.length === 0) return null;

                    // Ordenar por longitud de texto (preferir el más corto = más específico)
                    candidates.sort((a, b) => {
                        const ta = (a.innerText || a.textContent || '').trim().length;
                        const tb = (b.innerText || b.textContent || '').trim().length;
                        return ta - tb;
                    });

                    const best = candidates[0];
                    const bestText = (best.innerText || best.textContent || '').trim();

                    // Verificar que el texto es razonablemente "SGDEA - Ingreso a Expediente"
                    const lowerText = bestText.toLowerCase();
                    const isSgdea = lowerText.includes('sgdea');
                    if (!isSgdea) return null;

                    best.scrollIntoView({ block: 'center' });
                    // Doble clic para abrir el formulario
                    best.click();
                    best.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

                    return {
                        text: bestText.substring(0, 80),
                        tag: best.tagName,
                        cls: best.className.substring(0, 40),
                        count: candidates.length
                    };
                }).catch(() => null);

                if (r) {
                    log(`   ✅ Tipología seleccionada (intento ${attempt+1}): "${r.text}"`);
                    log(`      Tag: ${r.tag} | Class: ${r.cls} | Candidatos SGDEA: ${r.count}`);
                    sgdeaClicked = true; break;
                }
            }
            if (sgdeaClicked) break;
        }
        if (!sgdeaClicked) log(`   [intento ${attempt+1}] Tipología no encontrada, esperando...`);
    }
    if (!sgdeaClicked) { log('   ❌ Tipología SGDEA no encontrada. Cerrando.'); await browser.close(); return; }

    // Esperar a que el formulario abra (puede tardar)
    await wait(6000);


    // ── ETAPA 4: LOCALIZAR LA PÁGINA/FRAME DEL FORMULARIO SGDEA ─────────────
    // El formulario se abre en una NUEVA TAB o dentro de un iframe.
    // Esperamos hasta 20s a que aparezca la página con el formulario SGDEA.
    log('ETAPA 4: Esperando que se abra el formulario SGDEA...');
    let formPage = null, formFrame = null;

    // Función: busca el input del campo "Código Expediente" en un frame
    const findExpedienteInput = async (fr) => {
        return await fr.evaluate(() => {
            // Strateregia 1: buscar por label "Código Expediente" en tabla
            const allTds = Array.from(document.querySelectorAll('td, th, label, span, div'));
            const labelTd = allTds.find(el => {
                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                return t === 'código expediente' || t === 'codigo expediente'
                    || t === 'código expediente *' || t === 'codigo expediente *';
            });
            if (labelTd) {
                // Buscar el input en la misma fila o celda siguiente
                const row = labelTd.closest('tr');
                if (row) {
                    const inp = row.querySelector('input[type="text"], input:not([type]):not([readonly])');
                    if (inp) {
                        const r = inp.getBoundingClientRect();
                        if (r.width > 0) return { found: true, x: r.left, y: r.top, w: r.width, h: r.height, method: 'by_label_row' };
                    }
                }
                // Buscar en la celda adyacente
                const nextTd = labelTd.nextElementSibling;
                if (nextTd) {
                    const inp = nextTd.querySelector('input') || nextTd.querySelector('select');
                    if (inp) {
                        const r = inp.getBoundingClientRect();
                        if (r.width > 0) return { found: true, x: r.left, y: r.top, w: r.width, h: r.height, method: 'by_label_sibling' };
                    }
                }
            }
            // Estrategia 2: buscar por title/name/id
            const byAttr = document.querySelector(
                'input[title*="xpediente" i], input[name*="xpediente" i], input[id*="xpediente" i]'
            );
            if (byAttr && !byAttr.readOnly) {
                const r = byAttr.getBoundingClientRect();
                if (r.width > 0) return { found: true, x: r.left, y: r.top, w: r.width, h: r.height, method: 'by_attr' };
            }
            return { found: false };
        }).catch(() => ({ found: false }));
    };

    for (let t = 0; t < 40 && !formFrame; t++) {
        await wait(500);
        const allPages = await browser.pages();
        for (const pg of allPages) {
            for (const fr of pg.frames()) {
                const result = await findExpedienteInput(fr);
                if (result.found) {
                    formPage = pg;
                    formFrame = fr;
                    log(`   ✅ Formulario detectado (${(t*0.5).toFixed(1)}s) via "${result.method}" | frame: ${fr.url().substring(0, 60)}`);
                    break;
                }
            }
            if (formFrame) break;
        }
        if (t % 4 === 0) log(`   [t=${(t*0.5).toFixed(0)}s] Esperando formulario SGDEA...`);
    }

    if (!formFrame) { log('   ❌ Formulario SGDEA no encontrado. Cerrando.'); await browser.close(); return; }
    await formPage.bringToFront();
    await wait(800);

    // ── ETAPA 5: OBTENER COORDENADAS REALES DEL CAMPO ───────────────────────
    log('ETAPA 5: Calculando coordenadas reales del campo Código Expediente...');
    let clickX = null, clickY = null;
    try {
        // Obtener el offset del iframe dentro de la página
        const frameEl = await formFrame.frameElement().catch(() => null);
        let offX = 0, offY = 0;
        if (frameEl) {
            const fBox = await frameEl.boundingBox().catch(() => null);
            if (fBox) { offX = fBox.x; offY = fBox.y; }
            log(`   Offset del iframe: x=${Math.round(offX)}, y=${Math.round(offY)}`);
        }

        // Buscar el input y obtener su posición dentro del iframe
        const inputInfo = await findExpedienteInput(formFrame);
        if (inputInfo.found) {
            clickX = offX + inputInfo.x + inputInfo.w / 2;
            clickY = offY + inputInfo.y + inputInfo.h / 2;
            log(`   ✅ Input encontrado via "${inputInfo.method}"`);
            log(`   Posición en iframe: (${Math.round(inputInfo.x)}, ${Math.round(inputInfo.y)}) | tamaño: ${Math.round(inputInfo.w)}x${Math.round(inputInfo.h)}`);
            log(`   Coordenadas absolutas de clic: (${Math.round(clickX)}, ${Math.round(clickY)})`);
        } else {
            log('   [WARN] No se pudo obtener posición exacta del campo');
        }
    } catch (e) { log(`   [WARN] ${e.message}`); }

    // ── ETAPA 6: CLIC EN EL CAMPO + LIMPIAR + ESCRIBIR EL CÓDIGO ────────────
    log(`ETAPA 6: Interactuando con campo Código Expediente — escribiendo "${code}"...`);

    // Scroll al campo
    await formFrame.evaluate(() => {
        const allTds = Array.from(document.querySelectorAll('td, th, label, span'));
        const lbl = allTds.find(el => (el.innerText || '').toLowerCase().includes('código expediente'));
        if (lbl) {
            const row = lbl.closest('tr');
            if (row) {
                const inp = row.querySelector('input');
                if (inp) inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    }).catch(() => {});
    await wait(500);

    // Clic en el campo (con coordenadas absolutas correctas)
    if (clickX !== null && clickY !== null) {
        await formPage.mouse.click(clickX, clickY);
        log(`   ✅ Clic en campo (${Math.round(clickX)}, ${Math.round(clickY)})`);
    } else {
        // Fallback: clic directo por evaluación en el frame
        await formFrame.evaluate(() => {
            const allTds = Array.from(document.querySelectorAll('td'));
            const lbl = allTds.find(el => (el.innerText || '').toLowerCase().includes('código expediente'));
            if (lbl) {
                const row = lbl.closest('tr');
                if (row) { const inp = row.querySelector('input'); if (inp) inp.click(); }
            }
        });
        log('   Clic por evaluación directa (fallback)');
    }
    await wait(400);

    // Limpiar con Ctrl+A + Delete
    await formPage.keyboard.down('Control');
    await formPage.keyboard.press('a');
    await formPage.keyboard.up('Control');
    await wait(100);
    await formPage.keyboard.press('Delete');
    await wait(200);
    log('   Campo limpiado');

    // ── ESCRIBIR EL CÓDIGO CARÁCTER A CARÁCTER ───────────────────────────────
    log(`   Escribiendo "${code}" — ${code.length} teclas con delay ${TYPE_DELAY}ms...`);
    await formPage.keyboard.type(code, { delay: TYPE_DELAY });

    // Verificar valor en DOM
    const domVal = await formFrame.evaluate(() => {
        const allTds = Array.from(document.querySelectorAll('td'));
        const lbl = allTds.find(el => (el.innerText || '').toLowerCase().includes('código expediente'));
        if (lbl) {
            const row = lbl.closest('tr');
            if (row) { const inp = row.querySelector('input'); return inp ? inp.value : '(sin input)'; }
        }
        return '(label no encontrado)';
    }).catch(() => '(error)');
    log(`   Valor en DOM: "${domVal}"`);
    if (domVal === code) log('   ✅ Código escrito correctamente');
    else log(`   ⚠️  DOM tiene "${domVal}" pero esperábamos "${code}"`);

    await wait(1000);

    // ── ETAPA 7: ESPERAR DROPDOWN Y SELECCIONAR LA SUGERENCIA ───────────────
    log('ETAPA 7: Esperando dropdown de sugerencias OnBase (hasta 10s)...');
    let dropdownHandled = false;

    const DROPDOWN_SELS = [
        'ul.CodeEntry_DropdownList_ItemRowList li',
        '.CodeEntry_DropdownList li',
        'ul[class*="dropdown" i] li',
        'div[class*="dropdown" i] div[class*="item" i]',
        'table.AutoCompleteList td',
        '.ac_results li',
        '.ui-autocomplete li',
        '.ui-menu-item',
        '[role="option"]',
        '[role="listbox"] li',
        'li[class*="suggestion" i]',
        'li[class*="complete" i]',
    ];

    for (let t = 0; t < 20 && !dropdownHandled; t++) {
        await wait(500);
        for (const pg of await browser.pages()) {
            for (const fr of pg.frames()) {
                try {
                    const frameEl = await fr.frameElement().catch(() => null);
                    let offX = 0, offY = 0;
                    if (frameEl) {
                        const box = await frameEl.boundingBox().catch(() => null);
                        if (box) { offX = box.x; offY = box.y; }
                    }

                    const suggestion = await fr.evaluate((sels, sc) => {
                        for (const s of sels) {
                            const items = Array.from(document.querySelectorAll(s)).filter(el => {
                                const r = el.getBoundingClientRect();
                                return r.width > 0 && r.height > 0;
                            });
                            if (items.length > 0) {
                                const match = items.find(i => (i.innerText || i.textContent || '').includes(sc)) || items[0];
                                const r = match.getBoundingClientRect();
                                if (r.width > 0) return {
                                    lx: r.left + r.width / 2,
                                    ly: r.top + r.height / 2,
                                    text: (match.innerText || match.textContent || '').trim().substring(0, 80),
                                    sel: s,
                                    count: items.length
                                };
                            }
                        }
                        return null;
                    }, DROPDOWN_SELS, code);

                    if (suggestion) {
                        log(`   ✅ Dropdown detectado (${(t*0.5).toFixed(1)}s) via "${suggestion.sel}"`);
                        log(`   Seleccionando: "${suggestion.text}"`);
                        await pg.mouse.click(offX + suggestion.lx, offY + suggestion.ly);
                        log('   Clic en sugerencia hecho. Esperando autorrelleno...');
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
        log('   ⚠️  Dropdown no detectado. Probando ArrowDown + Enter...');
        await formPage.keyboard.press('ArrowDown');
        await wait(600);
        await formPage.keyboard.press('ArrowDown');
        await wait(300);
        await formPage.keyboard.press('Enter');
        await wait(3000);
    }

    // ── ETAPA 8: VERIFICAR CAMPOS AUTORRELLENOS ──────────────────────────────
    log('\nETAPA 8: Leyendo campos autorrellenos por OnBase...');
    const autoFields = await formFrame.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select'))
            
            .map(el => ({
                label: (() => {
                    const row = el.closest('tr');
                    if (row) {
                        const prevTd = row.querySelector('td:first-child, th:first-child');
                        return prevTd ? (prevTd.innerText || '').trim().substring(0, 40) : '';
                    }
                    return el.title || el.name || el.id || '?';
                })(),
                value: el.value.trim().substring(0, 70),
                readonly: el.readOnly
            }));
    }).catch(() => []);

    log(`\n${'═'.repeat(55)}`);
    log(`CAMPOS CON VALOR (${autoFields.length}):`);
    autoFields.forEach(f => log(`  [${f.readonly ? 'SOLO LECTURA' : 'EDITABLE    '}] ${f.label}: "${f.value}"`));
    log(`${'═'.repeat(55)}\n`);

    const hasNombre = autoFields.some(f => f.value.length > 10 && f.readonly);
    if (hasNombre) log('✅ ÉXITO — OnBase rellenó los campos automáticamente tras seleccionar el código.');
    else           log('⚠️  PARCIAL — El código fue digitado pero los campos no se autorrellaron aún.');

    log('🛑 Pausa 30s para inspección visual del formulario. NO se guarda nada.');
    await wait(30000);
    log('Cerrando navegador...');
    await browser.close();
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
    const docId = process.argv[2] ? parseInt(process.argv[2]) : null;
    const docInfo = await getDocInfo(docId);
    if (!docInfo) { log('Sin documento de prueba. Abortando.'); process.exit(1); }
    await runAES(docInfo);
})().catch(e => { console.error('[ERROR FATAL]', e.message); process.exit(1); });

