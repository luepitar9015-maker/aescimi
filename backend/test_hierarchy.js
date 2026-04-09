const http = require('http');

const payload = JSON.stringify({
    type: 'subseries',
    id: 1,
    hierarchy: [
        { id: '1', type: 'dep', label: 'Código Dependencia' },
        { id: '2', type: 'ser', label: 'Código Serie' }
    ]
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/trd/hierarchy',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (e) => console.error('Error:', e));
req.write(payload);
req.end();
