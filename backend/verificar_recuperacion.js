const { Client } = require('pg');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'sena_db',
};

async function checkTRD() {
    const db = new Client(pgConfig);
    try {
        await db.connect();
        console.log("--- VERIFICACIÓN DE DATOS REUPERADOS (TRD) ---");
        
        const resDeps = await db.query("SELECT count(*) FROM organization_structure");
        const resSeries = await db.query("SELECT count(*) FROM trd_series");
        const resSub = await db.query("SELECT count(*) FROM trd_subseries");
        const resTyp = await db.query("SELECT count(*) FROM trd_typologies");

        console.log(`Dependencias: ${resDeps.rows[0].count}`);
        console.log(`Series: ${resSeries.rows[0].count}`);
        console.log(`Subseries: ${resSub.rows[0].count}`);
        console.log(`Tipologías: ${resTyp.rows[0].count}`);

        if (parseInt(resSeries.rows[0].count) > 0) {
            console.log("\n¡ÉXITO! La configuración de las TRD ya está en la base de datos PostgreSQL.");
            console.log("Solo falta encender el frontend para verlas.");
        } else {
            console.log("\nADVERTENCIA: No se encontraron series. Es posible que el archivo SQLite estuviera vacío o falte un paso.");
        }

    } catch (err) {
        console.error("Error conectando a la base de datos:", err.message);
    } finally {
        await db.end();
    }
}

checkTRD();
