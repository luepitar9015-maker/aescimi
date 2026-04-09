const puppeteer = require('puppeteer');
const fs = require('fs');

async function testForms() {
    const browser = await puppeteer.launch({ 
        headless: 'new', // try headless again
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    try {
        const page = await browser.newPage();
        await page.goto('https://onbase.sena.edu.co/Onbase/Login.aspx', {waitUntil: 'networkidle2'});
        
        // login
        await page.waitForSelector('#username');
        await page.type('#username', '1098680638');
        await page.type('#password', 'Sena2025**');
        
        const loginBtn = await page.$('#loginButton, button[type="submit"], input[type="submit"]');
        if (loginBtn) {
            await loginBtn.click();
        } else {
            await page.keyboard.press('Enter');
        }
        await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 30000});
        
        console.log("URL post-login: " + page.url());
        
        await new Promise(r => setTimeout(r, 6000));
        
        // Find "Nuevo formulario"
        const newFormOk = await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a, span, div, li')).find(el => {
                const t = (el.innerText || '').trim().toLowerCase();
                return t === 'nuevo formulario' || t === 'new form';
            });
            if (link) {
                link.scrollIntoView();
                link.click();
                return true;
            }
            return false;
        });
        console.log("Click en nuevo formulario: " + newFormOk);
        
        await new Promise(r => setTimeout(r, 6000));
        
        let sgdeaClicked = false;
        for (const frame of page.frames()) {
            const coords = await frame.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll('a, [role="treeitem"]'));
                const target = candidates.find(el => (el.innerText || '').toUpperCase().includes('SGDEA'));
                if (target) {
                    target.scrollIntoView({block: 'center'});
                    const rect = target.getBoundingClientRect();
                    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                }
                return null;
            });
            
            if (coords) {
                let fOffsetX = 0, fOffsetY = 0;
                try {
                    const box = await (await frame.frameElement()).boundingBox();
                    fOffsetX = box.x; fOffsetY = box.y;
                } catch(e) {}
                await page.mouse.click(fOffsetX + coords.x, fOffsetY + coords.y, {clickCount: 2});
                sgdeaClicked = true;
                break;
            }
        }
        console.log("Click en SGDEA nativo: " + sgdeaClicked);
        
        await new Promise(r => setTimeout(r, 10000));
        
        console.log("Tomando screenshot...");
        await page.screenshot({ path: 'onbase_debug.png', fullPage: true });
        
        const html = await page.content();
        fs.writeFileSync('onbase_form_debug.html', html);
        
        console.log("Evaluando los frames a ver si encontramos el formulario...");
        for(let i=0; i<page.frames().length; i++) {
            const f = page.frames()[i];
            try {
                const fhtml = await f.content();
                fs.writeFileSync(`frame_${i}.html`, fhtml);
                
                const btns = await f.evaluate(() => {
                   return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]')).map(b => b.innerText || b.value || b.title); 
                });
                console.log(`[Frame ${i}] - URL: ${f.url()} - Botones: ${btns.join(', ')}`);
            } catch(ex) {
                console.log(`[Frame ${i}] Error: ${ex.message}`);
            }
        }
        
    } catch(e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testForms();
