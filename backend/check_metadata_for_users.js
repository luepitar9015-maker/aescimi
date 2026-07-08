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
        console.log("=== COMPROBANDO USUARIOS EN METADATOS DE EXPEDIENTES ===");
        
        // Obtener la lista de usuarios
        const usersRes = await client.query("SELECT id, full_name FROM users");
        const users = usersRes.rows;
        
        // Obtener todos los expedientes
        const expRes = await client.query("SELECT id, title, metadata_values FROM expedientes");
        const expedientes = expRes.rows;
        
        let coincidenciaEncontrada = 0;
        
        for (const exp of expedientes) {
            const metaStr = typeof exp.metadata_values === 'string' 
                ? exp.metadata_values 
                : JSON.stringify(exp.metadata_values || {});
                
            const metaLower = metaStr.toLowerCase();
            
            for (const user of users) {
                // Separar el nombre en partes para buscar coincidencias parciales
                const nameParts = user.full_name.toLowerCase().split(' ').filter(p => p.length > 3);
                
                // Si todas las partes principales del nombre coinciden en el JSON
                if (nameParts.length > 0 && nameParts.every(part => metaLower.includes(part))) {
                    console.log(`Coincidencia: Expediente ID ${exp.id} ("${exp.title}") contiene indicios del usuario "${user.full_name}"`);
                    console.log(`  Metadatos: ${metaStr}\n`);
                    coincidenciaEncontrada++;
                    if (coincidenciaEncontrada > 10) {
                        console.log("... se muestran solo las primeras 10 coincidencias.");
                        break;
                    }
                }
            }
            if (coincidenciaEncontrada > 10) break;
        }
        
        if (coincidenciaEncontrada === 0) {
            console.log("No se encontró ningún nombre de usuario de la base de datos dentro de los metadatos de los expedientes.");
        } else {
            console.log(`Total de coincidencias encontradas: ${coincidenciaEncontrada}`);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
