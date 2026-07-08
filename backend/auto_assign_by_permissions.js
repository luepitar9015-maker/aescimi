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
        console.log("=== AUTO-ASIGNANDO EXPEDIENTES SEGÚN PERMISOS DE TRD ===");
        await client.query("BEGIN");

        // 1. Obtener todas las series actuales con sus códigos
        const seriesRes = await client.query("SELECT id, series_code FROM trd_series");
        const series = seriesRes.rows;

        // 2. Obtener todos los permisos activos de los usuarios
        const permRes = await client.query("SELECT user_id, series_id FROM user_trd_permissions WHERE series_id IS NOT NULL");
        const permissions = permRes.rows;

        // 3. Obtener todos los expedientes
        const expRes = await client.query("SELECT id, subserie FROM expedientes");
        const expedientes = expRes.rows;

        console.log(`Total expedientes a procesar: ${expedientes.length}`);
        console.log(`Total de mapeos de permisos activos: ${permissions.length}`);

        let assignmentsCreated = 0;

        for (const exp of expedientes) {
            const expSub = exp.subserie || '';
            
            // Prioridad 1: Coincidencia exacta
            let dbSerie = series.find(s => (s.series_code || '') === expSub);
            
            // Prioridad 2: Coincidencia por sufijo
            if (!dbSerie) {
                dbSerie = series.find(s => {
                    const code = s.series_code || '';
                    return (expSub && code.endsWith(`-${expSub}`)) || (code && expSub.endsWith(`-${code}`));
                });
            }

            if (!dbSerie) continue;

            // Buscar qué usuarios tienen permisos asignados para esta serie
            const authorizedUsers = permissions.filter(p => p.series_id === dbSerie.id);

            for (const perm of authorizedUsers) {
                // Crear la asignación si no existe
                await client.query(`
                    INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (expediente_id, user_id) DO NOTHING
                `, [exp.id, perm.user_id, 1, 'Auto-asignado basado en permisos de serie TRD']);
                
                assignmentsCreated++;
            }
        }

        await client.query("COMMIT");
        console.log(`\n=== PROCESO COMPLETADO ===`);
        console.log(`Total de asignaciones de expedientes creadas en la base de datos: ${assignmentsCreated}`);

    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Error en auto-asignación:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
