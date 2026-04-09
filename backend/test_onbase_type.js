/**
 * PRUEBA: Digitación del Código de Expediente en OnBase (AES)
 * ===========================================================
 * Solo valida hasta el punto en que OnBase reconoce el código
 * y muestra el dropdown de sugerencias.
 *
 * Uso:  node test_onbase_type.js [codigo]
 * Ej:   node test_onbase_type.js 2025EX-035881
 */

const puppeteer = require('puppeteer');

const ONBASE_URL = 'https://onbase.sena.edu.co/Onbase/Login.aspx';
const USERNAME   = '1098680638';
const PASSWORD   = 'Santander2026**';
const CODE       = process.argv[2] || '2025EX-035881';
const TYPE_DELAY = 120; // ms entre teclas

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

async function runTest() {
    log(`=== INICIO PRUEBA | Código: "${CODE}" ===\n`);
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page    = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // ── 1. LOGIN ──────────────────────────────────────────────────────────────
    log('1. Navegando a OnBase y haciendo login...');
    await page.goto(ONBASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(2000);
    await page.type('#username', USERNAME, { delay: 60 });
    await page.type('#password', PASSWORD, { delay: 60 });
    await page.keyboard.press('Enter');
    await wait(8000);
    log(`   URL post-login: ${page.url().substring(0, 80)}`);

    // ── 2. ABRIR NUEVO FORMULARIO ─────────────────────────────────────────────
    log('2. Abriendo Nuevo Formulario...');
    await page.evaluate(() => { document.querySelector('.js-navMenuButton')?.click(); });
    await wait(1200);
    await page.evaluate(() => { document.querySelector('#newform')?.click(); });
    await wait(4500);

    // ── 3. SELECCIONAR TIPOLOGÍA SGDEA ────────────────────────────────────────
    log('3. Seleccionando "SGDEA - Ingreso a Expediente"...');
    let sgdeaClicked = false;
    for (let attempt = 0; attempt < 3 && !sgdeaClicked; attempt++) {
        for (const fr of page.frames()) {
            const r = await fr.evaluate(() => {
                const lis = Array.from(document.querySelectorAll('li'));
                const f = lis.find(x =>
                    (x.innerText || x.textContent || '').toLowerCase().includes('sgdea')
                );
                if (f) {
                    f.scrollIntoView({ block: 'center' });
                    f.click();
                    f.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                    return (f.innerText || '').trim().substring(0, 60);
                }
                return null;
            }).catch(() => null);
            if (r) { log(`   ✅ Tipología: "${r}"`); sgdeaClicked = true; break; }
        }
        if (!sgdeaClicked) await wait(2000);
    }
    if (!sgdeaClicked) { log('   ❌ Tipología no encontrada. Cerrando.'); await browser.close(); return; }
    await wait(5000);

    // ── 4. LOCALIZAR FRAME CON EL FORMULARIO ─────────────────────────────────
    log('4. Localizando frame con el campo de expediente...');
    let formPage = null, formFrame = null;
    for (let t = 0; t < 30 && !formFrame; t++) {
        await wait(500);
        for (const pg of await browser.pages()) {
            for (const fr of pg.frames()) {
                const has = await fr.evaluate((sel) => !!document.querySelector(sel), INPUT_SEL).catch(() => false);
                if (has) {
                    formPage = pg; formFrame = fr;
                    log(`   ✅ Frame encontrado (${(t * 0.5).toFixed(1)}s): ${fr.url().substring(0, 70)}`);
                    break;
                }
            }
            if (formFrame) break;
        }
    }
    if (!formFrame) { log('   ❌ Frame no encontrado. Cerrando.'); await browser.close(); return; }

    await formPage.bringToFront();
    await wait(600);

    // ── 5. COORDENADAS REALES DEL CAMPO ──────────────────────────────────────
    log('5. Calculando posición del campo en pantalla...');
    let clickX = null, clickY = null;
    try {
        const frameEl  = await formFrame.frameElement().catch(() => null);
        let offX = 0, offY = 0;
        if (frameEl) {
            const box = await frameEl.boundingBox().catch(() => null);
            if (box) { offX = box.x; offY = box.y; }
        }
        const rect = await formFrame.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width, h: r.height, title: el.title || el.name || el.id || '' };
        }, INPUT_SEL);
        if (rect && rect.w > 0) {
            clickX = offX + rect.x + rect.w / 2;
            clickY = offY + rect.y + rect.h / 2;
            log(`   Campo: title="${rect.title}" | coords=(${Math.round(clickX)}, ${Math.round(clickY)})`);
        }
    } catch (e) { log(`   [WARN] ${e.message}`); }

    // ── 6. CLIC + LIMPIAR ────────────────────────────────────────────────────
    log('6. Haciendo clic en el campo y limpiando...');
    await formFrame.evaluate((sel) => { document.querySelector(sel)?.scrollIntoView({ block: 'center' }); }, INPUT_SEL);
    await wait(400);
    if (clickX !== null) {
        await formPage.mouse.click(clickX, clickY);
        log(`   Clic en (${Math.round(clickX)}, ${Math.round(clickY)})`);
    } else {
        await formFrame.click(INPUT_SEL);
        log('   Clic por selector (fallback)');
    }
    await wait(300);
    await formPage.keyboard.down('Control');
    await formPage.keyboard.press('a');
    await formPage.keyboard.up('Control');
    await formPage.keyboard.press('Delete');
    await wait(200);

    // ── 7. ESCRIBIR CÓDIGO TECLA A TECLA ─────────────────────────────────────
    log(`7. Escribiendo "${CODE}" (delay ${TYPE_DELAY}ms por tecla)...`);
    try {
        await formPage.keyboard.type(CODE, { delay: TYPE_DELAY });
        const val = await formFrame.evaluate((sel) => document.querySelector(sel)?.value || '', INPUT_SEL);
        log(`   ✅ Valor en DOM: "${val}"`);
        if (val === CODE) log('   ✅ COINCIDE con el código esperado.');
        else              log(`   ⚠️  DIFERENCIA — esperado: "${CODE}"`);
    } catch (e) {
        log(`   [ERROR] ${e.message}`);
        log('   [FALLBACK] Clic en (520, 355) y reintento...');
        await formPage.mouse.click(520, 355);
        await wait(400);
        await formPage.keyboard.type(CODE, { delay: 150 });
    }

    await wait(1000);

    // ── 8. DETECTAR DROPDOWN (sin seleccionar) ────────────────────────────────
    log('8. Esperando que OnBase muestre el dropdown de sugerencias...');
    let dropdownFound = false;
    for (let t = 0; t < 20 && !dropdownFound; t++) {
        await wait(500);
        for (const pg of await browser.pages()) {
            for (const fr of pg.frames()) {
                try {
                    const found = await fr.evaluate((sels, sc) => {
                        for (const s of sels) {
                            const items = Array.from(document.querySelectorAll(s)).filter(e => {
                                const r = e.getBoundingClientRect();
                                return r.width > 0 && r.height > 0;
                            });
                            if (items.length) {
                                const texts = items.map(i => (i.innerText || i.textContent || '').trim()).filter(Boolean);
                                return { selector: s, items: texts.slice(0, 5) };
                            }
                        }
                        return null;
                    }, DROPDOWN_SELS, CODE);

                    if (found) {
                        log(`\n   ✅ DROPDOWN DETECTADO (${(t * 0.5).toFixed(1)}s) via "${found.selector}":`);
                        found.items.forEach((item, i) => log(`      [${i + 1}] ${item}`));
                        dropdownFound = true;
                        break;
                    }
                } catch { }
            }
            if (dropdownFound) break;
        }
    }

    if (!dropdownFound) {
        log('\n   ❌ DROPDOWN NO DETECTADO — OnBase no reconoció el código.');
        log('   Verifica que el código existe en el sistema y que el formulario está activo.');
    }

    // ── 9. PAUSA FINAL ────────────────────────────────────────────────────────
    log('\n=== FIN DE PRUEBA ===');
    log(`Resultado: ${dropdownFound ? '✅ ÉXITO — OnBase reconoció el código.' : '❌ FALLO — OnBase no mostró sugerencias.'}`);
    log('Pausando 20s para inspección visual. Luego se cierra el navegador...\n');
    await wait(20000);
    await browser.close();
}

runTest().catch(e => { console.error('[ERROR FATAL]', e.message); process.exit(1); });
