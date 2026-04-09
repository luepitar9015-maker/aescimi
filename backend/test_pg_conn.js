const { Client } = require('pg');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'postgres'
};

async function test() {
    console.log("Testing connection to PG on port 6000...");
    const client = new Client(pgConfig);
    try {
        await client.connect();
        console.log("Connection successful!");
        const res = await client.query('SELECT version()');
        console.log("PG Version:", res.rows[0].version);
    } catch (err) {
        console.error("Connection failed details:", err.message);
        console.error("Stack trace:", err.stack);
    } finally {
        await client.end();
    }
}

test();
