require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

const BASE_PATH = "/mnt/almacen";

async function sync() {
    const client = await pool.connect();
    try {
        console.log("=== INICIANDO SYNC DE CARPETAS A BASE DE DATOS ===");
        
        if (!fs.existsSync(BASE_PATH)) {
            console.error(`La ruta base ${BASE_PATH} no existe en este servidor.`);
            return;
        }

        // 1. Obtener todas las series y subseries de la BD para mapeo
        const seriesRes = await client.query("SELECT id, series_code, series_name FROM trd_series");
        const seriesList = seriesRes.rows;

        // 2. Escanear carpetas de primer nivel (Regional + Centro, ej: 689224)
        const rootDirs = fs.readdirSync(BASE_PATH).filter(f => {
            return fs.statSync(path.join(BASE_PATH, f)).isDirectory() && f.match(/^\d+$/);
        });

        let totalExpedientesCreados = 0;
        let totalDocumentosCreados = 0;

        for (const rootDir of rootDirs) {
            const rootPath = path.join(BASE_PATH, rootDir);
            
            // 3. Escanear carpetas de segundo nivel (Código de Serie, ej: 68922437)
            const seriesDirs = fs.readdirSync(rootPath).filter(f => {
                return fs.statSync(path.join(rootPath, f)).isDirectory();
            });

            for (const seriesDir of seriesDirs) {
                const seriesPath = path.join(rootPath, seriesDir);
                
                // Extraer el sufijo de la serie (los últimos 2 dígitos, ej: 68922437 -> "37")
                const serieSuffix = seriesDir.substring(seriesDir.length - 2);
                
                // Buscar serie correspondiente en la BD
                const dbSerie = seriesList.find(s => {
                    const code = s.series_code || '';
                    return code === serieSuffix || code.endsWith(`-${serieSuffix}`);
                });

                if (!dbSerie) {
                    console.log(`[AVISO] No se encontró la serie con código sufijo "${serieSuffix}" en la BD. Saltando: ${seriesDir}`);
                    continue;
                }

                // 4. Escanear carpetas de tercer nivel (Código de Subserie / Ficha, ej: 3410871)
                const subseriesDirs = fs.readdirSync(seriesPath).filter(f => {
                    return fs.statSync(path.join(seriesPath, f)).isDirectory();
                });

                for (const subseriesDir of subseriesDirs) {
                    const subseriesPath = path.join(seriesPath, subseriesDir);
                    
                    // 5. Escanear carpetas de cuarto nivel (Expedientes físicos, ej: "TI 1097502484" o "72025000410")
                    const expDirs = fs.readdirSync(subseriesPath).filter(f => {
                        return fs.statSync(path.join(subseriesPath, f)).isDirectory();
                    });

                    for (const expDir of expDirs) {
                        const expPath = path.join(subseriesPath, expDir);
                        
                        // Parsear el nombre del expediente físico
                        let docType = "00";
                        let docNum = expDir;
                        let title = expDir;

                        // Si el nombre contiene espacio (ej: "TI 1097502484" o "CC 123456")
                        if (expDir.includes(" ")) {
                            const parts = expDir.split(" ");
                            docType = parts[0];
                            docNum = parts[1];
                        }

                        // Determinar los metadatos a insertar
                        const metadata = {};
                        if (serieSuffix === "37") { // Historias Académicas
                            metadata.valor1 = "TITULADA";
                            metadata.valor2 = subseriesDir; // Ficha
                            metadata.valor3 = docType;       // CC, TI, etc.
                            metadata.valor4 = docNum;        // Documento
                            metadata.valor5 = "";            // Nombre Completo (se llenará después)
                            metadata.valor6 = "";
                            metadata.valor7 = "";
                            metadata.valor8 = "";
                        } else { // Otros (ej: Contratos/Peticiones)
                            metadata.valor1 = "ANONIMO";
                            metadata.valor2 = "NO INDICADO";
                            metadata.valor3 = "00";
                            metadata.valor4 = docNum;
                            metadata.valor5 = "";
                            metadata.valor6 = "";
                            metadata.valor7 = "";
                            metadata.valor8 = "";
                        }

                        // 6. Verificar si el expediente ya existe en la base de datos
                        // Buscamos si existe por title o si metadata contiene el documento (valor4) y la ficha (valor2)
                        let dbExpId = null;
                        const checkQuery = `
                            SELECT id FROM expedientes 
                            WHERE title = $1 
                               OR (subserie = $2 AND metadata_values LIKE $3)
                            LIMIT 1
                        `;
                        const searchPattern = `%${docNum}%`;
                        const checkRes = await client.query(checkQuery, [title, dbSerie.series_code, searchPattern]);

                        if (checkRes.rowCount > 0) {
                            dbExpId = checkRes.rows[0].id;
                        } else {
                            // Crear expediente nuevo en la BD
                            const insertExpQuery = `
                                INSERT INTO expedientes 
                                (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                                VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9) 
                                RETURNING id
                            `;
                            const insertParams = [
                                "", // expediente_code
                                "", // box_id
                                dbSerie.series_code, // subserie (usamos el código de la serie)
                                "68", // regional
                                "9224", // centro
                                "68922437", // dependencia
                                "ELECTRÓNICO", // storage_type
                                title, // title
                                JSON.stringify(metadata) // metadata_values
                            ];

                            const insertRes = await client.query(insertExpQuery, insertParams);
                            dbExpId = insertRes.rows[0].id;
                            totalExpedientesCreados++;
                            console.log(`[CREADO] Expediente: "${title}" (Ficha: ${subseriesDir}) -> ID BD: ${dbExpId}`);
                        }

                        // 7. Escanear archivos PDF en este expediente
                        const files = fs.readdirSync(expPath).filter(f => {
                            return fs.statSync(path.join(expPath, f)).isFile() && f.toLowerCase().endsWith(".pdf");
                        });

                        for (const file of files) {
                            const filePath = path.join(expPath, file);
                            
                            // Verificar si el documento ya está registrado para este expediente
                            const checkDocQuery = `
                                SELECT id FROM documents 
                                WHERE expediente_id = $1 AND filename = $2
                                LIMIT 1
                            `;
                            const checkDocRes = await client.query(checkDocQuery, [dbExpId, file]);

                            if (checkDocRes.rowCount === 0) {
                                // Limpiar tipología a partir del nombre del archivo (ej: "01_DOCUMENTO DE IDENTIDAD VIGENTE.pdf" -> "DOCUMENTO DE IDENTIDAD VIGENTE")
                                let cleanTypology = file.replace(/\.pdf$/i, "");
                                // Quitar prefijos numéricos como "01_", "02_"
                                cleanTypology = cleanTypology.replace(/^\d+[-_]/, "").trim();

                                // Normalizar tipologías comunes para asegurar correspondencia exacta con TRD
                                const upperClean = cleanTypology.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                if (upperClean.includes("RESPUESTA") && upperClean.includes("PETICI")) {
                                    cleanTypology = "RESPUESTA A DERECHO DE PETICION";
                                } else if (upperClean.includes("PETICI") && !upperClean.includes("RESPUESTA")) {
                                    cleanTypology = "DERECHO DE PETICION";
                                }

                                // Insertar documento en la BD
                                const insertDocQuery = `
                                    INSERT INTO documents 
                                    (organization_id, trd_series_id, trd_subseries_id, expediente_id, filename, path, typology_name, status, load_date, document_date) 
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                `;
                                const insertDocParams = [
                                    1, // organization_id
                                    dbSerie.id, // trd_series_id
                                    null, // trd_subseries_id
                                    dbExpId, // expediente_id
                                    file, // filename
                                    filePath, // path
                                    cleanTypology, // typology_name
                                    'Cargado' // status
                                ];

                                await client.query(insertDocQuery, insertDocParams);
                                totalDocumentosCreados++;
                            }
                        }
                    }
                }
            }
        }

        console.log("\n=== RESUMEN FINAL DEL PROCESO ===");
        console.log(`Expedientes nuevos registrados en BD: ${totalExpedientesCreados}`);
        console.log(`Documentos nuevos registrados en BD:   ${totalDocumentosCreados}`);
        console.log("=========================================");

    } catch (err) {
        console.error("Error crítico durante la sincronización:", err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

sync();
