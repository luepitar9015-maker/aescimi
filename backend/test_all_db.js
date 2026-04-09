require('dotenv').config({path: '.env'});
const pg = require('pg');
const automationController = require('./controllers/automationController');

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

async function testController() {
    console.log('[TEST] Obteniendo credenciales predeterminadas quemadas...');
    const creds = {
        url: process.env.VITE_ONBASE_URL || 'https://onbase.sena.edu.co/Onbase/Login.aspx',
        username: 'JRROZO',
        password: 'Sena2025**'
    };
    
    console.log(`[TEST] URL: ${creds.url}, User: ${creds.username}`);

    try {
        const { rows } = await pool.query("SELECT d.id, d.expediente_id, e.expediente_code FROM documents d JOIN expedientes e ON d.expediente_id = e.id WHERE d.status = 'Pendiente' AND e.expediente_code IS NOT NULL LIMIT 1");
        
        if (rows.length === 0) {
            console.log('[TEST] No test doc found. Please run add_test_doc.js');
            process.exit(1);
        }
        
        const docId = rows[0].id;
        console.log(`[TEST] Inyectando robots en Document ID: ${docId}`);
        
        const req = {
            body: {
                url: creds.url,
                username: creds.username,
                password: creds.password,
                documentId: docId
            }
        };

        const res = {
            status: (code) => {
                console.log(`[HTTP STATUS] ${code}`);
                return res;
            },
            json: (data) => {
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
        
        await automationController.executeAutomation(req, res);
    } catch(err) {
        console.error('[TEST] ERROR FATAL:', err);
        process.exit(1);
    }
}
testController();
