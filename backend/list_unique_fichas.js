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
        console.log("=== EXTRACCIÓN DE FICHAS DE HISTORIAS ACADÉMICAS ===");
        
        // Consultar los expedientes de Historias Académicas
        const res = await client.query(`
            SELECT id, title, metadata_values 
            FROM expedientes 
            WHERE subserie = '68.9224.4-37'
        `);
        
        const expedientes = res.rows;
        const fichasMap = {};
        
        expedientes.forEach(exp => {
            let meta = {};
            try {
                meta = typeof exp.metadata_values === 'string' 
                    ? JSON.parse(exp.metadata_values) 
                    : (exp.metadata_values || {});
            } catch (e) {}
            
            // La ficha se almacena típicamente en valor2
            const ficha = (meta.valor2 || 'SIN_FICHA').trim();
            const programa = (meta.valor1 || 'Sin Programa').trim();
            
            const key = `${ficha} - ${programa}`;
            if (!fichasMap[key]) {
                fichasMap[key] = { ficha, programa, count: 0 };
            }
            fichasMap[key].count++;
        });
        
        const fichasArray = Object.values(fichasMap);
        // Ordenar por número de ficha
        fichasArray.sort((a, b) => a.ficha.localeCompare(b.ficha));
        
        console.log(`Total de expedientes analizados: ${expedientes.length}`);
        console.log(`Total de Fichas/Programas únicos encontrados: ${fichasArray.length}`);
        console.table(fichasArray);
        
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
