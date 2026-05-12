/**
 * test_mass_insert.js
 * Prueba el endpoint /api/expedientes/mass con 25 registros de prueba.
 * Ejecutar: node test_mass_insert.js
 */
require('dotenv').config();
const { pool } = require('./database_pg');

async function testMassInsert() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('   DIAGNÓSTICO: Inserción Masiva de Expedientes');
    console.log('══════════════════════════════════════════════════\n');

    // Generar 25 expedientes de prueba
    const testExpedientes = Array.from({ length: 25 }, (_, i) => ({
        expediente_code: `TEST-${String(i + 1).padStart(3, '0')}`,
        box_id: `CAJA-${Math.ceil((i + 1) / 5)}`,
        opening_date: `2026-0${(i % 9) + 1}-01`,
        subserie: i < 10 ? '68.9224.4-37' : (i < 18 ? '68.9224-27' : '68.9224.4-28'),
        regional: 'Regional Santander',
        centro: 'Centro General',
        dependencia: 'Dependencia Test',
        storage_type: 'Fisico',
        title: `Expediente de Prueba #${i + 1}`,
        metadata_values: { valor1: `Val${i}`, valor2: `Dato${i}` }
    }));

    const client = await pool.connect();
    const errors = [];
    let created = 0;

    try {
        await client.query('BEGIN');
        console.log(`📋 Intentando insertar ${testExpedientes.length} registros...\n`);

        // Helper: normaliza fecha
        const normalizeDate = (val) => {
            if (!val || val === '') return null;
            if (typeof val === 'number') {
                const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
            }
            const str = String(val).trim();
            const colMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (colMatch) return `${colMatch[3]}-${colMatch[2].padStart(2,'0')}-${colMatch[1].padStart(2,'0')}`;
            const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (dashMatch) return `${dashMatch[3]}-${dashMatch[2].padStart(2,'0')}-${dashMatch[1].padStart(2,'0')}`;
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : str;
        };

        for (let i = 0; i < testExpedientes.length; i++) {
            const exp = testExpedientes[i];
            const params = [
                exp.expediente_code || null,
                exp.box_id || null,
                normalizeDate(exp.opening_date),
                exp.subserie || null,
                exp.regional || null,
                exp.centro || null,
                exp.dependencia || null,
                exp.storage_type || null,
                exp.title && exp.title.trim() !== '' ? exp.title.trim() : null,
                JSON.stringify(exp.metadata_values || {})
            ];

            const savepointName = `sp_test_${i}`;
            try {
                await client.query(`SAVEPOINT ${savepointName}`);
                const result = await client.query(
                    `INSERT INTO expedientes 
                     (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                    params
                );
                await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                console.log(`  ✅ Fila ${i + 1}: ${exp.expediente_code} → ID ${result.rows[0].id}`);
                created++;
            } catch (err) {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                const errMsg = err.detail || err.message;
                console.error(`  ❌ Fila ${i + 1}: ${exp.expediente_code} → ERROR: ${errMsg}`);
                errors.push({ fila: i + 1, expediente: exp.expediente_code, error: errMsg });
            }
        }

        // ROLLBACK para no contaminar la BD con datos de prueba
        await client.query('ROLLBACK');
        console.log('\n[TEST] Cambios revertidos (ROLLBACK) - datos de prueba no guardados.\n');

    } catch (fatalErr) {
        await client.query('ROLLBACK');
        console.error('❌ ERROR FATAL:', fatalErr.message);
    } finally {
        client.release();
        await pool.end();
    }

    console.log('══════════════════════════════════════════════════');
    console.log(`📊 RESULTADO: ${created} exitosos, ${errors.length} fallidos de 25`);
    if (errors.length > 0) {
        console.log('\n🔴 ERRORES:');
        errors.forEach(e => console.log(`   Fila ${e.fila}: ${e.error}`));
    } else {
        console.log('\n✅ Todos los registros se insertan correctamente.');
        console.log('   El problema puede estar en los datos del Excel del usuario.');
    }
    console.log('══════════════════════════════════════════════════\n');
}

testMassInsert().catch(console.error);
