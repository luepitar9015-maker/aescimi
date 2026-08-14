const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    console.log('Iniciando navegador...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    try {
        console.log('Navegando a OnBase...');
        await page.goto('https://onbase.sena.edu.co/Onbase/Login.aspx', { waitUntil: 'networkidle2', timeout: 35000 });
        await wait(2000);

        console.log('Esperando campos de texto...');
        await page.waitForSelector('input', { timeout: 15000 });

        console.log('Escribiendo credenciales...');
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const u = inputs.find(i => i.type === 'text' || i.name === 'username' || i.id === 'username' || i.className.includes('user'));
            const p = inputs.find(i => i.type === 'password' || i.name === 'password' || i.id === 'password' || i.className.includes('pass'));
            if (u) {
                u.focus();
                u.value = 'JRROZO';
                u.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (p) {
                p.focus();
                p.value = 'Sena2025**';
                p.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await wait(1000);
        await page.keyboard.press('Enter');
        
        console.log('Esperando navegación post-login...');
        await wait(12000);
        console.log('Post-login URL:', page.url());

        // Buscar el frame de Recuperación (Retrieve.aspx)
        let retrieveFrame = null;
        for (const fr of page.frames()) {
            if (fr.url().includes('Retrieve.aspx')) {
                retrieveFrame = fr;
                break;
            }
        }

        if (!retrieveFrame) {
            console.error('No se encontró el frame de Retrieve.aspx');
            await page.screenshot({ path: 'd:\\SENA V2\\INSTALADOR_SENA\\backend\\query_fields_error.png', fullPage: true });
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

        if (clicked) {
            console.log('Tipo documental clickeado:', clicked);
        } else {
            console.log('No se pudo encontrar "01-FRM-Comunicacion Producida"');
        }

        await wait(4000);

        // Ver qué inputs y labels aparecieron en el frame
        console.log('Buscando campos que aparecieron en el frame...');
        const fields = await retrieveFrame.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label, .field-label, .keyword-label, th'))
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

        console.log('Labels encontrados:', fields.labels);
        console.log('Inputs encontrados (visibles):', fields.inputs.filter(i => i.visible));

        // Tomar screenshot
        await page.screenshot({ path: 'd:\\SENA V2\\INSTALADOR_SENA\\backend\\query_fields_debug.png', fullPage: true });
        console.log('Screenshot guardado.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
        console.log('Navegador cerrado.');
    }
})();
