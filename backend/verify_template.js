const http = require('http');
const fs = require('fs');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/expedientes/template',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    if (res.statusCode === 200) {
        const file = fs.createWriteStream('test_template.xlsx');
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('Plantilla descargada como test_template.xlsx');
            process.exit(0);
        });
    } else {
        console.error('Error al descargar la plantilla');
        process.exit(1);
    }
});

req.on('error', (e) => {
    console.error(`Problema con la petición: ${e.message}`);
    process.exit(1);
});

req.end();
