const { Client } = require('pg');

const config = { host: 'localhost', user: 'postgres', password: 'postgres', database: 'simo_concursos', port: 5432 };

async function main() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to simo_concursos successfully!");
        
        const tablesRes = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
        );
        console.log("Tables in simo_concursos:");
        console.table(tablesRes.rows);

        for (const row of tablesRes.rows) {
            const t = row.table_name;
            try {
                const countRes = await client.query(`SELECT COUNT(*) FROM ${t}`);
                console.log(`${t}: ${countRes.rows[0].count}`);
            } catch (err) {
                console.log(`${t}: Error - ${err.message}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

main();
