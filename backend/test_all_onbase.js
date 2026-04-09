const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./database');
const automationController = require('./controllers/automationController');

async function testController() {
    console.log('[TEST] Buscando documento Pendiente para configurar...');
    db.get("SELECT d.id, d.expediente_id, e.expediente_code FROM documents d JOIN expedientes e ON d.expediente_id = e.id WHERE d.status = 'Pendiente' AND e.expediente_code IS NOT NULL LIMIT 1", async (err, row) => {
        if (err || !row) {
            console.log('[TEST] No hay doc. Run add_test_doc.js first.');
            return;
        }
        
        console.log(`[TEST] Usando Document ID: ${row.id}`);
        // Config base que sabemos debe venir del frontend
        const req = {
            body: {
                url: process.env.VITE_ONBASE_URL || 'https://onbase.sena.edu.co/Onbase/Login.aspx',
                username: process.env.VITE_ONBASE_USERNAME || '9914',
                password: process.env.VITE_ONBASE_PASSWORD || 'Enero2026*',
                documentId: row.id
            }
        };

        const res = {
            status: (code) => {
                console.log(`[HTTP STATUS] ${code}`);
                return res;
            },
            json: (data) => {
                console.log(`[HTTP JSON RESPONSE]`);
                if(data.logs) {
                    console.log('--- LOGS DEL ROBOT ---');
                    console.log(data.logs.join('\n'));
                }
                if(data.error) {
                    console.error('--- ERROR ---', data.error);
                }
                process.exit(0);
            }
        };

        console.log('[TEST] Llamando a automationController.executeAutomation()...');
        try {
            await automationController.executeAutomation(req, res);
        } catch(e) {
            console.error('[TEST] ERROR FATAL:', e);
            process.exit(1);
        }
    });
}

testController();
