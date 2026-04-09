const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/documents',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Response data count:', json.data ? json.data.length : 'N/A');
            if (res.statusCode === 200) {
                console.log('Document search test: SUCCESS');
            } else {
                console.error('Document search test: FAILED', json.error);
            }
        } catch (e) {
            console.error('Error parsing response:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
