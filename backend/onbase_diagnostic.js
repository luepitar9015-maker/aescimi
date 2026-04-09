const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // Login
    await page.goto('https://onbase.sena.edu.co/Onbase/Login.aspx', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
    await wait(2000);
    await page.evaluate((u, p) => {
        const inputs = document.querySelectorAll('input');
        let tf = null, pf = null;
        inputs.forEach(el => { if (!tf && el.type !== 'password') tf = el; if (!pf && el.type === 'password') pf = el; });
        if (tf) { tf.focus(); tf.value = u; tf.dispatchEvent(new Event('input', { bubbles: true })); }
        if (pf) { pf.focus(); pf.value = p; pf.dispatchEvent(new Event('input', { bubbles: true })); }
    }, 'JRROZO', 'Sena2025**');

    // Click login button
    await page.click('#loginButton').catch(() => page.keyboard.press('Enter'));
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => { });
    await wait(7000);
    console.log('✅ Login OK. URL:', page.url());

    // Open menu
    await page.click('.js-navMenuButton').catch(() => { });
    await wait(1500);
    console.log('✅ Menú abierto');

    // Click Nuevo Formulario
    await page.click('#newform').catch(() => { });
    await wait(6000);
    console.log('✅ Nuevo Formulario cargado');

    // Filter and click SGDEA
    const frames = () => page.frames();
    for (const f of frames()) {
        try {
            const filtered = await f.evaluate(() => {
                const box = document.querySelector('input[placeholder="Escriba para filtrar"]');
                if (box) { box.focus(); box.value = 'SGDEA'; box.dispatchEvent(new Event('input', { bubbles: true })); box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); return true; }
                return false;
            });
            if (filtered) { console.log('✅ Filtro SGDEA aplicado'); break; }
        } catch { }
    }
    await wait(2000);

    for (const f of frames()) {
        try {
            const clicked = await f.evaluate(() => {
                const lis = Array.from(document.querySelectorAll('li.CSListBlock_listOption, li.js-listOption'));
                const found = lis.find(l => (l.innerText || '').toLowerCase().includes('sgdea') && (l.innerText || '').toLowerCase().includes('ingreso'));
                if (found) { found.scrollIntoView(); found.click(); found.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return (found.innerText || '').trim(); }
                return null;
            });
            if (clicked) { console.log('✅ SGDEA seleccionado:', clicked); break; }
        } catch { }
    }
    await wait(6000);

    // Capture all frames
    console.log('\n======== FRAMES DESPUÉS DE SGDEA ========');
    for (let i = 0; i < page.frames().length; i++) {
        let t = '', u = '';
        try { t = await page.frames()[i].title(); u = page.frames()[i].url(); } catch { }
        console.log(`Frame[${i}]: "${t}" → ${u.replace('https://onbase.sena.edu.co/Onbase/', '')}`);
    }

    // Dump ALL frames fields now
    console.log('\n======== CAMPOS DE TODOS LOS FRAMES ========');
    for (let i = 0; i < page.frames().length; i++) {
        const frame = page.frames()[i];
        try {
            // Get the full body HTML for the SGDEA form frame
            const frameUrl = frame.url();
            if (frameUrl.includes('UnityForm') || frameUrl.includes('NewUnityForm') || frameUrl.includes('templateid=148')) {
                console.log(`\n🎯 FRAME SGDEA FORM [${i}]: ${frameUrl.replace('https://onbase.sena.edu.co/Onbase/', '')}`);

                // Get all labels
                const labels = await frame.evaluate(() => {
                    return Array.from(document.querySelectorAll('label, .field-label, .keyword-label, .form-label, th, [class*="label"]'))
                        .filter(el => el.innerText && el.innerText.trim() && el.offsetParent !== null)
                        .map(el => ({ tag: el.tagName, id: el.id, cls: el.className.substring(0, 50), txt: el.innerText.trim().substring(0, 80) }));
                });
                console.log('Labels:', JSON.stringify(labels));

                // Get all inputs
                const inputs = await frame.evaluate(() => {
                    return Array.from(document.querySelectorAll('input, textarea, select'))
                        .filter(el => el.type !== 'hidden')
                        .map(el => {
                            const lbl = el.labels && el.labels[0] ? el.labels[0].innerText.trim() : '';
                            const row = el.closest('tr, .form-group, .field-row, .keyword-container, [class*="row"], [class*="field"]');
                            const rowTxt = row ? (row.innerText || '').trim().split('\n')[0].substring(0, 80) : '';
                            return { tag: el.tagName, type: el.type, id: el.id, name: el.name, label: lbl || rowTxt };
                        });
                });
                console.log('\nInputs:', JSON.stringify(inputs, null, 2));

                // Full body HTML (first 5000 chars)
                const bodyHtml = await frame.evaluate(() => document.body.innerHTML.substring(0, 6000));
                console.log('\nBody HTML:', bodyHtml);
            } else {
                const inputs = await frame.evaluate(() =>
                    Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
                        .filter(el => el.offsetParent !== null || el.offsetWidth > 0)
                        .map(el => ({ type: el.type, id: el.id, name: el.name, placeholder: el.placeholder }))
                );
                if (inputs.length > 0) {
                    console.log(`Frame[${i}] inputs:`, JSON.stringify(inputs));
                }
            }
        } catch (e) { console.log(`Frame[${i}] error: ${e.message}`); }
    }

    await page.screenshot({ path: 'C:\\tmp\\sgdea_form_full.png', fullPage: true });
    await browser.close();
    console.log('\nDone. Screenshot: C:\\tmp\\sgdea_form_full.png');
})();
