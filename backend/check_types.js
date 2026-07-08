require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function main() {
    const client = await pool.connect();
    try {
        const seriesRes = await client.query("SELECT id, series_code FROM trd_series");
        const series = seriesRes.rows;

        const permRes = await client.query("SELECT user_id, series_id FROM user_trd_permissions WHERE series_id IS NOT NULL");
        const permissions = permRes.rows;

        const expRes = await client.query("SELECT id, subserie FROM expedientes WHERE subserie = '68.9224.4-37' LIMIT 5");
        const expedientes = expRes.rows;

        console.log("Expedientes:", expedientes);
        
        for (const exp of expedientes) {
            const expSub = exp.subserie || '';
            const dbSerie = series.find(s => {
                const code = s.series_code || '';
                return expSub === code;
            });
            console.log("dbSerie encontrada:", dbSerie);
            if (dbSerie) {
                console.log("Tipos: dbSerie.id =", typeof dbSerie.id, ", perm.series_id =", typeof permissions[0].series_id);
                const authorizedUsers = permissions.filter(p => p.series_id === dbSerie.id);
                console.log("authorizedUsers filtrados:", authorizedUsers);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
