/**
 * Revertir documento de prueba a estado "Pendiente" en SQLite
 * Uso: node revert_test_doc.js [expediente_code]
 * Ej:  node revert_test_doc.js 2025EX-035881
 */
const db = require('./database');

const CODE = process.argv[2] || '2025EX-035881';

console.log(`\n[INFO] Revirtiendo documentos del expediente "${CODE}" a estado Pendiente...\n`);

// Primero listar qué documentos existen para ese expediente
db.all(`
    SELECT d.id, d.filename, d.status, e.expediente_code
    FROM documents d
    LEFT JOIN expedientes e ON d.expediente_id = e.id
    WHERE e.expediente_code = ? OR d.status = 'Cargado'
    LIMIT 20
`, [CODE], (err, rows) => {
    if (err) {
        console.error('[ERROR] Al consultar:', err.message);
        process.exit(1);
    }

    console.log(`[INFO] Documentos encontrados: ${rows.length}`);
    rows.forEach(r => console.log(`  - ID:${r.id} | ${r.filename} | Estado: ${r.status} | Expediente: ${r.expediente_code || 'N/A'}`));

    if (rows.length === 0) {
        console.log('[WARN] No se encontraron documentos. Listando TODOS los documentos:');
        db.all('SELECT id, filename, status FROM documents LIMIT 20', [], (err2, all) => {
            if (err2) return console.error(err2);
            all.forEach(r => console.log(`  - ID:${r.id} | ${r.filename} | ${r.status}`));
            process.exit(0);
        });
        return;
    }

    // Revertir documentos del expediente específico a Pendiente
    db.run(`
        UPDATE documents
        SET status = 'Pendiente', ades_id = NULL
        WHERE expediente_id IN (
            SELECT id FROM expedientes WHERE expediente_code = ?
        )
    `, [CODE], function(err2) {
        if (err2) {
            console.error('[ERROR] Al revertir:', err2.message);
            // Intentar revertir por filename
            db.run(`UPDATE documents SET status = 'Pendiente', ades_id = NULL WHERE filename LIKE '%PRUEBA%' OR filename LIKE '%prueba%'`, [], function(err3) {
                if (err3) return console.error('[ERROR]:', err3.message);
                console.log(`\n[OK] ${this.changes} documento(s) de prueba revertidos a Pendiente.`);
                process.exit(0);
            });
            return;
        }

        if (this.changes === 0) {
            // Si no hubo cambios, revertir TODOS los Cargados (para pruebas)
            console.log('[INFO] No se encontraron documentos con ese código. Revirtiendo el primer documento Cargado...');
            db.run(`
                UPDATE documents SET status = 'Pendiente', ades_id = NULL
                WHERE id = (SELECT id FROM documents WHERE status = 'Cargado' LIMIT 1)
            `, [], function(err4) {
                if (err4) return console.error('[ERROR]:', err4.message);
                console.log(`\n[OK] ${this.changes} documento(s) revertidos a Pendiente.`);
                process.exit(0);
            });
        } else {
            console.log(`\n[OK] ${this.changes} documento(s) revertidos a Pendiente.`);
            process.exit(0);
        }
    });
});
