require('dotenv').config();
const https = require('https');

function testModels() {
    console.log('--- TEST DE MODELOS DE GEMINI ---');
    const apiKey = process.env.GEMINI_API_KEY;
    
    console.log('Llamando a la API de Google para listar modelos con la nueva clave...');
    
    https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                    console.error('ERROR de Google:', parsed.error.message);
                    return;
                }
                console.log('\nMODELOS DISPONIBLES EN TU CUENTA:');
                parsed.models.forEach(m => {
                    console.log(`- ${m.name}`);
                });
            } catch (e) {
                console.error('Error procesando respuesta:', e.message);
            }
        });
    }).on('error', (e) => {
        console.error('Error de red:', e.message);
    });
}

testModels();
