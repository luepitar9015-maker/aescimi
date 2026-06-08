require('dotenv').config();
const { Pool } = require('pg');

console.log("Environment configuration:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "***hidden***" : "not set");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        process.exit(1);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            console.error('Error executing query:', err.stack);
            process.exit(1);
        }
        console.log('Successfully connected to the database!');
        console.log('Current time in database:', result.rows[0]);
        
        // Let's also check if tables exist
        client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'", (err2, res2) => {
            if (err2) {
                console.error('Error querying tables:', err2.stack);
            } else {
                console.log('Tables found in database:', res2.rows.map(r => r.table_name));
            }
            process.exit(0);
        });
    });
});
