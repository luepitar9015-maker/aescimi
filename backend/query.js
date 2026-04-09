const { Client } = require('pg');
const client = new Client({user: 'postgres', host: 'localhost', database: 'sena_db', password: 'admin', port: 5432});
client.connect().then(() => {
    return client.query('DELETE FROM users WHERE document_no=$1', ['SUSPEND123']);
}).then(res => {
    console.log('Deleted test user');
    client.end();
}).catch(e => {
    console.log('Error', e.message);
    client.end();
});
