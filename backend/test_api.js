const http = require('http');

http.get('http://localhost:5000/api/organization', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    try {
      JSON.parse(data);
      console.log('VALID JSON');
    } catch (e) {
      console.log('INVALID JSON:', e.message);
    }
  });
}).on('error', err => console.log('Req err:', err.message));
