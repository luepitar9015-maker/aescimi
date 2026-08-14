const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

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
                    // Escribir el valor directamente usando element.evaluate
                    await element.evaluate((el, val) => {
                        el.focus();
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, text);
                    
                    await wait(500);
                    
                    // Verificar si se escribió bien
                    const currentVal = await element.evaluate(el => el.value).catch(() => '');
                    if (currentVal === text) {
                        return true;
                    }
                    
                    // Fallback typing
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
        } catch (e) {}
        await wait(800);
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
        await wait(800);
    }
    return false;
};

async function paso1_login(page, url, username, password, logs) {
    logs.push('[PASO 1] Navegando a OnBase...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        .catch(e => logs.push(`[PASO 1][WARN] goto: ${e.message}`));
    await wait(3000);

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
            logs.push(`[PASO 1][WARN] Esperando estabilidad de la página para SSO: ${e.message}`);
            await wait(2000);
        }
    }

    if (isMicrosoftSSO) {
        logs.push('[PASO 1] Detectado inicio de sesión de Microsoft (SSO)');
        let effectiveUsername = username;
        if (!username.includes('@')) {
            effectiveUsername = `${username}@sena.edu.co`;
        }

        logs.push('[PASO 1] Buscando campo de correo de Microsoft...');
        const emailOk = await safeType(page, 'input[type="email"], input[name="loginfmt"], #i0116', effectiveUsername, 60);
        if (!emailOk) return false;
        
        logs.push('[PASO 1] Clic en "Siguiente" de Microsoft...');
        await safeClick(page, 'input[type="submit"], #idSIButton9');
        await wait(3000);
        
        logs.push('[PASO 1] Buscando campo de contraseña de Microsoft...');
        const passOk = await safeType(page, 'input[type="password"], input[name="passwd"], #i0118', password, 60);
        if (!passOk) return false;
        
        logs.push('[PASO 1] Clic en "Iniciar Sesión" (Microsoft)...');
        await safeClick(page, 'input[type="submit"], #idSIButton9');
        await wait(6000);
        
        // Esperar si sale "Mantener la sesión iniciada"
        let staySignedIn = false;
        for (let i = 0; i < 6; i++) {
            staySignedIn = await page.evaluate(() => {
                const hasStayText = document.body ? (document.body.innerText.includes('mantener la sesión') || 
                                    document.body.innerText.includes('Stay signed in')) : false;
                const hasNoBtn = !!document.querySelector('#idBtn_Back');
                return hasStayText && hasNoBtn;
            }).catch(() => false);
            if (staySignedIn) break;
            await wait(1000);
        }
        
        if (staySignedIn) {
            logs.push('[PASO 1] Clic en "No" en pantalla mantener sesión...');
            await safeClick(page, '#idBtn_Back');
            await wait(6000);
        } else {
            logs.push('[PASO 1] No se detectó pantalla "Mantener sesión", esperando redirección...');
            await wait(8000);
        }
    }

    // Esperar a que la URL cambie de microsoftonline a sena.edu.co/Onbase
    console.log('Esperando URL final...');
    let success = false;
    for (let i = 0; i < 15; i++) {
        const u = page.url();
        if (u.includes('onbase.sena.edu.co') && (u.includes('NavPanel') || u.includes('Dashboard') || u.includes('Retrieve') || u.includes('Home'))) {
            success = true;
            break;
        }
        logs.push(`[PASO 1] URL actual: ${u} (esperando sena.edu.co...)`);
        await wait(2000);
    }

    const postUrl = page.url();
    logs.push(`[PASO 1] URL post-login final: ${postUrl}`);
    return success;
}

(async () => {
    const logs = [];
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    try {
        const loginOk = await paso1_login(page, 'https://onbase.sena.edu.co/Onbase/Login.aspx', 'JRROZO', 'Sena2025**', logs);
        console.log(logs.join('\n'));
        if (!loginOk) {
            console.error('Login fallido.');
            await page.screenshot({ path: 'd:\\SENA V2\\INSTALADOR_SENA\\backend\\check_login_error.png' });
            await browser.close();
            return;
        }

        console.log('Login exitoso!');
        await wait(6000);

        // Buscar retrieveFrame
        let retrieveFrame = null;
        for (const fr of page.frames()) {
            if (fr.url().includes('Retrieve.aspx')) {
                retrieveFrame = fr;
                break;
            }
        }

        if (!retrieveFrame) {
            console.error('No se encontró el frame de Retrieve.aspx');
            await page.screenshot({ path: 'd:\\SENA V2\\INSTALADOR_SENA\\backend\\check_retrieve_error.png' });
            await browser.close();
            return;
        }

        console.log('Frame de recuperación encontrado:', retrieveFrame.url());

        // Buscar el item "01-FRM-Comunicacion Producida"
        console.log('Buscando tipo documental "01-FRM-Comunicacion Producida"...');
        const clicked = await retrieveFrame.evaluate(() => {
            const lis = Array.from(document.querySelectorAll('li'));
            const target = lis.find(l => (l.innerText || '').includes('01-FRM-Comunicacion Producida'));
            if (target) {
                target.scrollIntoView();
                target.click();
                target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                return target.innerText;
            }
            return null;
        });

        console.log('Resultado del click en tipo documental:', clicked);
        await wait(5000);

        // Volver a evaluar qué inputs y labels aparecieron en el frame
        const fields = await retrieveFrame.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label, .field-label, .keyword-label, th, td'))
                .map(el => (el.innerText || '').trim())
                .filter(Boolean);
            const inputs = Array.from(document.querySelectorAll('input, select, textarea'))
                .filter(el => el.type !== 'hidden')
                .map(el => ({
                    id: el.id,
                    name: el.name,
                    title: el.title,
                    placeholder: el.placeholder,
                    type: el.type,
                    visible: el.offsetWidth > 0 && el.offsetHeight > 0
                }));
            return { labels, inputs };
        });

        console.log('--- LABELS ---');
        console.log(fields.labels.slice(0, 100)); // Mostrar los primeros 100 labels
        console.log('--- INPUTS VISIBLES ---');
        console.log(fields.inputs.filter(i => i.visible));

        await page.screenshot({ path: 'd:\\SENA V2\\INSTALADOR_SENA\\backend\\check_query_form.png', fullPage: true });
        console.log('Screenshot guardado.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
        console.log('Navegador cerrado.');
    }
})();
