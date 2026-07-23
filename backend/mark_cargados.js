require('dotenv').config();
const db = require('./database');

function markExpedientesCargados() {
    const targetCodes = ['2025EX-035886', '2025EX-036124'];
    console.log('[MARK-CARGADOS] Procesando códigos:', targetCodes);

    let processed = 0;

    targetCodes.forEach(code => {
        const cleanCode = code.trim();
        console.log(`\n[MARK-CARGADOS] Buscando: ${cleanCode}`);

        const findExpSql = `
            SELECT id, expediente_code, title 
            FROM expedientes 
            WHERE expediente_code ILIKE ? OR title ILIKE ? OR metadata_values ILIKE ?
        `;

        db.all(findExpSql, [`%${cleanCode}%`, `%${cleanCode}%`, `%${cleanCode}%`], (err, exps) => {
            if (err) {
                console.error('[MARK-CARGADOS] Error buscando expedientes:', err.message);
                checkEnd();
                return;
            }
            console.log(`[MARK-CARGADOS] Expedientes encontrados para "${cleanCode}" (${exps ? exps.length : 0}):`, exps);

            const expIds = (exps || []).map(e => e.id);

            if (expIds.length > 0) {
                const placeholders = expIds.map(() => '?').join(',');
                const updateDocsSql = `
                    UPDATE documents 
                    SET status = 'Cargado', load_date = NOW() 
                    WHERE expediente_id IN (${placeholders})
                `;
                db.run(updateDocsSql, expIds, function(uErr) {
                    if (uErr) {
                        console.error('[MARK-CARGADOS] Error actualizando por exp ID:', uErr.message);
                    } else {
                        console.log(`[MARK-CARGADOS] ✅ Documentos por exp ID actualizados a "Cargado" para ${cleanCode}`);
                    }
                    checkEnd();
                });
            } else {
                checkEnd();
            }

            const updateDirectSql = `
                UPDATE documents 
                SET status = 'Cargado', load_date = NOW() 
                WHERE filename ILIKE ? OR metadata_values ILIKE ?
            `;
            db.run(updateDirectSql, [`%${cleanCode}%`, `%${cleanCode}%`], function(dErr) {
                if (dErr) {
                    console.error('[MARK-CARGADOS] Error actualizando documentos directos:', dErr.message);
                } else {
                    console.log(`[MARK-CARGADOS] ✅ Documentos directos actualizados a "Cargado" para ${cleanCode}`);
                }
            });
        });
    });

    function checkEnd() {
        processed++;
        if (processed >= targetCodes.length) {
            console.log('[MARK-CARGADOS] Proceso finalizado exitosamente.');
            setTimeout(() => process.exit(0), 1000);
        }
    }
}

markExpedientesCargados();
