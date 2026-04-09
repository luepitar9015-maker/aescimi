const { Client } = require('pg');

async function updatePassword() {
    const password = require('./database_pg').password;
    const client = new Client({
        user: 'postgres',
        password: password,
        host: 'localhost',
        database: 'sena_db',
        port: 5432,
    });
    
    try {
        await client.connect();
        await client.query("UPDATE system_settings SET value = $1 WHERE key = 'ades_password'", ['Sena2025**']);
        console.log("Password updated successfully.");
    } catch (e) {
        console.error("Error updating password:", e.message);
    } finally {
        await client.end();
    }
}

updatePassword();
