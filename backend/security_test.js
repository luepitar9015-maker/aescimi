const http = require('http');

const test = (label, path, method, expectedStatus, body) => {
  return new Promise(resolve => {
    const options = {
      host: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const ok = res.statusCode === expectedStatus;
        const icon = ok ? 'PASS' : 'FAIL';
        console.log(icon + ' [' + res.statusCode + '] ' + label);
        if (!ok) console.log('  Body:', data.substring(0, 120));
        resolve();
      });
    });
    req.on('error', e => { console.log('ERROR ' + label + ': ' + e.message); resolve(); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

(async () => {
  console.log('=== PRUEBAS DE SEGURIDAD ===\n');
  await test('GET /api/users sin auth -> 401',                  '/api/users',              'GET',  401);
  await test('POST /api/users sin auth -> 401',                 '/api/users',              'POST', 401);
  await test('DELETE /api/users/1 sin auth -> 401',             '/api/users/1',            'DELETE', 401);
  await test('GET /api/superuser/tables sin auth -> 401',       '/api/superuser/tables',   'GET',  401);
  await test('GET /api/superuser/table/users sin auth -> 401',  '/api/superuser/table/users', 'GET', 401);
  await test('POST /api/settings sin auth -> 401',              '/api/settings',            'POST', 401, { key: 'x', value: 'y' });
  await test('POST /api/auth/register sin auth -> 401',         '/api/auth/register',       'POST', 401, { document_no: '123' });
  await test('POST /api/generate-letters sin auth -> 401',      '/api/generate-letters',    'POST', 401);
  await test('GET /api/settings/all sin auth -> 401',           '/api/settings/all',        'GET',  401);
  console.log('\nPruebas completadas.');
})();
