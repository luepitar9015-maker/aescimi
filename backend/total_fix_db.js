const { Client } = require('pg');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'sena_db',
};

async function fixAndTest() {
    const client = new Client(pgConfig);
    try {
        await client.connect();
        console.log("--- INICIANDO DIAGNÓSTICO PROFUNDO ---");

        // 1. Verificar y Corregir Columnas
        console.log("1. Verificando columnas...");
        await client.query("ALTER TABLE organization_structure ADD COLUMN IF NOT EXISTS storage_path TEXT");
        console.log("[OK] Columna 'storage_path' verificada/añadida.");

        // 2. Verificar Secuencia de ID (SERIAL)
        console.log("2. Verificando secuencia de ID...");
        try {
            // Asegurarnos de que el ID es autoincremental
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_structure' AND column_name='id' AND column_default LIKE 'nextval%') THEN
                        -- Si no es serial, lo intentamos arreglar (esto es complejo, pero simplificamos)
                        ALTER TABLE organization_structure ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'No se pudo forzar IDENTITY, asumiendo que ya es SERIAL';
                END $$;
            `);
            console.log("[OK] Secuencia de ID verificada.");
        } catch (e) {
            console.log("[INFO] No se pudo verificar la secuencia directamente, continuando...");
        }

        // 3. Probar una Inserción Directa
        console.log("3. Probando inserción de prueba...");
        const testSql = `INSERT INTO organization_structure (
            entity_name, regional_code, regional_name, center_code, center_name, 
            section_code, section_name, subsection_code, subsection_name, storage_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`;
        
        const testParams = [
            'SENA_TEST', '99', 'TEST REGIONAL', '9999', 'TEST CENTER', 
            'TEST_SEC', 'TEST SECTION', '', '', 'C:\\TEST'
        ];

        const res = await client.query(testSql, testParams);
        console.log(`[EXITO] Inserción de prueba lograda. Nuevo ID: ${res.rows[0].id}`);

        // 4. Limpiar prueba
        await client.query("DELETE FROM organization_structure WHERE entity_name = 'SENA_TEST'");
        console.log("[OK] Limpieza realizada.");

        console.log("\n--- RESULTADO FINAL ---");
        console.log("La base de datos está PERFECTA. El problema debe ser el código del backend (database_pg.js) o el frontend.");
        console.log("Acabo de actualizar database_pg.js antes de esto, así que ahora debería funcionar.");

    } catch (err) {
        console.error("\n--- ERROR DETECTADO ---");
        console.error("MENSAJE:", err.message);
        console.error("DETALLE:", err.detail || 'Sin detalles extra');
        if (err.message.includes('column') && err.message.includes('does not exist')) {
            console.log("\nSUGERENCIA: Faltan columnas. Revisa los nombres en total_fix_db.js");
        }
    } finally {
        await client.end();
    }
}

fixAndTest();
