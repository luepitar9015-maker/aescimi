require('dotenv').config();
const { pool } = require('./database_pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = "/home/cimi/aescimi/backend/LUIS_MIGUEL_HERNANDEZ.xlsx";
const LUIS_HERNANDEZ_ID = 19;
const ADMIN_ID = 1; // Assigned by Admin

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
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

async function main() {
    try {
        console.log("=== INICIANDO VALIDACIÓN Y PROCESAMIENTO DE EXPEDIENTES DE LUIS HERNÁNDEZ ===");
        
        if (!fs.existsSync(excelPath)) {
            console.error("El archivo Excel no se encuentra en el servidor:", excelPath);
            process.exit(1);
        }

        // 1. Leer archivo Excel
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Total de registros leídos del Excel: ${rows.length}`);

        // Verificar el usuario en la BD
        const userRes = await pool.query("SELECT id, full_name, document_no FROM users WHERE id = $1", [LUIS_HERNANDEZ_ID]);
        if (userRes.rowCount === 0) {
            console.error(`Error: No se encontró el usuario con ID ${LUIS_HERNANDEZ_ID} en la base de datos.`);
            process.exit(1);
        }
        const user = userRes.rows[0];
        console.log(`Procesando asignaciones para: ${user.full_name} (Documento: ${user.document_no})`);

        let stats = {
            totalExcelRows: rows.length,
            matched: 0,
            missingCreated: 0,
            assignmentsCreated: 0,
            assignmentsAlreadyExist: 0,
            metadataEnriched: 0,
            totalDocumentsChecked: 0,
            brokenDocumentsFound: 0,
            errors: 0
        };

        const brokenDocumentsDetails = [];

        // Procesar en lote o iteración controlada
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            const subserie = String(row['Subserie'] || '68.9224.4-37').trim();
            const ficha = row['Valor 4'] ? String(row['Valor 4']).trim() : '';
            const valor5 = row['Valor 5'] ? String(row['Valor 5']).trim() : '';
            const apprenticeName = row['Valor 6'] ? String(row['Valor 6']).trim() : '';
            const storageType = row['Tipo Almacenamiento'] ? String(row['Tipo Almacenamiento']).trim() : 'Electronico';
            const openingDate = normalizeDate(row['Fecha Apertura']) || new Date().toISOString().split('T')[0];

            if (!valor5) {
                console.log(`[Fila ${i+1}] Saltando registro sin metadato 'Valor 5' (Documento).`);
                stats.errors++;
                continue;
            }

            // Separar docType y docNum
            let docType = 'CC';
            let docNum = valor5;
            if (valor5.includes(' ')) {
                const parts = valor5.split(/\s+/);
                docType = parts[0].trim();
                docNum = parts[1].trim();
            }

            // Buscar en BD por docNum (valor4) o title (Valor 5 completo)
            // Ya que el expediente puede estar registrado con title = "CC 1116182456" y metadata_values con valor4 = "1116182456"
            const searchRes = await pool.query(
                `SELECT id, title, metadata_values FROM expedientes 
                 WHERE subserie = $1 AND (metadata_values::jsonb->>'valor4' = $2 OR title = $3)`,
                [subserie, docNum, valor5]
            );

            let expId = null;
            let isNew = false;

            if (searchRes.rowCount > 0) {
                stats.matched++;
                const dbExp = searchRes.rows[0];
                expId = dbExp.id;

                // Enriquecer metadatos si el nombre del aprendiz (valor5 en DB) no estaba registrado
                let dbMeta = {};
                try {
                    dbMeta = typeof dbExp.metadata_values === 'string' ? JSON.parse(dbExp.metadata_values) : dbExp.metadata_values;
                } catch(e) {
                    dbMeta = {};
                }

                if (!dbMeta.valor5 || dbMeta.valor5.trim() === '') {
                    dbMeta.valor1 = "TITULADA";
                    dbMeta.valor2 = ficha;
                    dbMeta.valor3 = docType;
                    dbMeta.valor4 = docNum;
                    dbMeta.valor5 = apprenticeName;
                    dbMeta.valor6 = "";
                    dbMeta.valor7 = row['Valor 7'] ? String(row['Valor 7']).trim() : "";
                    dbMeta.valor8 = row['Valor 8'] ? String(row['Valor 8']).trim() : "";

                    await pool.query(
                        "UPDATE expedientes SET metadata_values = $1 WHERE id = $2",
                        [JSON.stringify(dbMeta), expId]
                    );
                    stats.metadataEnriched++;
                }
            } else {
                // Crear expediente faltante
                isNew = true;
                const dbMeta = {
                    valor1: "TITULADA",
                    valor2: ficha,
                    valor3: docType,
                    valor4: docNum,
                    valor5: apprenticeName,
                    valor6: "",
                    valor7: row['Valor 7'] ? String(row['Valor 7']).trim() : "",
                    valor8: row['Valor 8'] ? String(row['Valor 8']).trim() : ""
                };

                const insertRes = await pool.query(
                    `INSERT INTO expedientes 
                     (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                    ['', null, openingDate, subserie, '68', '9224', 'DEP', storageType, valor5, JSON.stringify(dbMeta)]
                );
                
                expId = insertRes.rows[0].id;
                stats.missingCreated++;
            }

            // Gestionar asignación a Luis Miguel Hernandez (user_id = 19)
            if (expId) {
                const assignCheck = await pool.query(
                    "SELECT id, estado FROM expediente_assignments WHERE expediente_id = $1 AND user_id = $2",
                    [expId, LUIS_HERNANDEZ_ID]
                );

                if (assignCheck.rowCount === 0) {
                    await pool.query(
                        `INSERT INTO expediente_assignments 
                         (expediente_id, user_id, assigned_by, observaciones, estado) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [expId, LUIS_HERNANDEZ_ID, ADMIN_ID, 'Asignado para cuadrar estadísticas según Excel', 'Cargado']
                    );
                    stats.assignmentsCreated++;
                } else {
                    stats.assignmentsAlreadyExist++;
                }

                // Verificar si hay documentos cargados en este expediente y si tienen enlaces dañados
                const docRes = await pool.query(
                    "SELECT id, filename, path, status FROM documents WHERE expediente_id = $1",
                    [expId]
                );

                for (const doc of docRes.rows) {
                    stats.totalDocumentsChecked++;
                    let fileExists = false;
                    try {
                        fileExists = fs.existsSync(doc.path);
                    } catch (err) {
                        fileExists = false;
                    }

                    if (!fileExists) {
                        stats.brokenDocumentsFound++;
                        brokenDocumentsDetails.push({
                            expediente_id: expId,
                            expediente_title: valor5,
                            document_id: doc.id,
                            filename: doc.filename,
                            path: doc.path,
                            status: doc.status
                        });
                    }
                }
            }
        }

        console.log("\n=== RESUMEN DE PROCESAMIENTO ===");
        console.log(`- Registros totales en el Excel:   ${stats.totalExcelRows}`);
        console.log(`- Expedientes coincidentes en BD:  ${stats.matched}`);
        console.log(`- Expedientes creados (faltantes): ${stats.missingCreated}`);
        console.log(`- Nuevas asignaciones creadas:     ${stats.assignmentsCreated}`);
        console.log(`- Asignaciones ya existentes:      ${stats.assignmentsAlreadyExist}`);
        console.log(`- Metadatos enriquecidos (Nombres):${stats.metadataEnriched}`);
        console.log(`- Documentos verificados en disco: ${stats.totalDocumentsChecked}`);
        console.log(`- Documentos con enlaces dañados:  ${stats.brokenDocumentsFound}`);
        console.log(`- Errores de fila:                 ${stats.errors}`);

        if (stats.brokenDocumentsFound > 0) {
            console.log("\n=== DOCUMENTOS CON ENLACES DAÑADOS ENCONTRADOS ===");
            console.table(brokenDocumentsDetails);
        } else {
            console.log("\n✅ Todos los documentos de los expedientes procesados tienen enlaces de archivos correctos.");
        }

    } catch (e) {
        console.error("Error en la ejecución:", e);
    } finally {
        await pool.end();
    }
}

main();
