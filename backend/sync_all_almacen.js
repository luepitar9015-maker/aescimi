require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sena_db',
    password: process.env.DB_PASSWORD || 'admin2026',
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

const BASE_PATH = "/mnt/almacen";

function getAllPdfFiles(dirPath, arrayOfFiles = []) {
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                getAllPdfFiles(fullPath, arrayOfFiles);
            } else if (file.toLowerCase().endsWith('.pdf')) {
                arrayOfFiles.push(fullPath);
            }
        }
    } catch (e) {}
    return arrayOfFiles;
}

async function syncAll() {
    const client = await pool.connect();
    try {
        console.log("=== ESCANEANDO RECURSIVAMENTE /mnt/almacen PARA REGISTRAR TODOS LOS PDFS EN BD ===");
        if (!fs.existsSync(BASE_PATH)) {
            console.error(`La ruta base ${BASE_PATH} no existe.`);
            return;
        }

        const allPdfs = getAllPdfFiles(BASE_PATH);
        console.log(`Total de archivos PDF físicos encontrados en /mnt/almacen: ${allPdfs.length}`);

        // Obtener series y subseries
        const seriesRes = await client.query("SELECT id, series_code, series_name FROM trd_series");
        const seriesList = seriesRes.rows;

        let expedientesCreados = 0;
        let documentosCreados = 0;
        let documentosExistentes = 0;

        for (const pdfPath of allPdfs) {
            const relPath = path.relative(BASE_PATH, pdfPath).replace(/\\/g, '/');
            const pathParts = relPath.split('/');
            const filename = pathParts[pathParts.length - 1];
            const expFolderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'General';

            // Detectar la subserie a partir de la ruta
            let subserieCode = '68.9224-27'; // fallback a Derechos de Peticion
            for (const part of pathParts) {
                if (part.includes('68922437') || part.includes('37')) subserieCode = '68.9224.4-37';
                else if (part.includes('689224-27') || part.includes('27')) subserieCode = '68.9224-27';
                else if (part.includes('2210') || part.includes('22.10')) subserieCode = '68.9224-22.10';
                else if (part.includes('5321') || part.includes('53.21')) subserieCode = '68.9224.4-53.21';
            }

            // Buscar la serie en BD
            const dbSerie = seriesList.find(s => (s.series_code || '').replace(/\D/g, '') === subserieCode.replace(/\D/g, '')) || seriesList[0];

            // 1. Buscar o crear expediente
            let expId = null;
            const expCheck = await client.query(
                "SELECT id FROM expedientes WHERE title = $1 OR metadata_values LIKE $2 LIMIT 1",
                [expFolderName, `%${expFolderName}%`]
            );

            if (expCheck.rowCount > 0) {
                expId = expCheck.rows[0].id;
            } else {
                const metadata = {
                    valor1: "CREADO AUTOMATICO",
                    valor2: "SISTEMA",
                    valor3: "00",
                    valor4: expFolderName,
                    valor5: "", valor6: "", valor7: "", valor8: ""
                };
                const expIns = await client.query(
                    `INSERT INTO expedientes 
                     (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values)
                     VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                    ["", "", subserieCode, "68", "9224", "68922437", "ELECTRÓNICO", expFolderName, JSON.stringify(metadata)]
                );
                expId = expIns.rows[0].id;
                expedientesCreados++;
            }

            // 2. Buscar o crear documento
            const docCheck = await client.query(
                "SELECT id FROM documents WHERE expediente_id = $1 AND filename = $2 LIMIT 1",
                [expId, filename]
            );

            if (docCheck.rowCount === 0) {
                let cleanTypology = filename.replace(/\.pdf$/i, "").replace(/^\d+[-_]/, "").trim();
                const upperClean = cleanTypology.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (upperClean.includes("RESPUESTA") && upperClean.includes("PETICI")) {
                    cleanTypology = "RESPUESTA A DERECHO DE PETICION";
                } else if (upperClean.includes("PETICI") && !upperClean.includes("RESPUESTA")) {
                    cleanTypology = "DERECHO DE PETICION";
                }

                await client.query(
                    `INSERT INTO documents 
                     (organization_id, trd_series_id, expediente_id, filename, path, typology_name, status, document_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                    [1, dbSerie ? dbSerie.id : null, expId, filename, pdfPath, cleanTypology, 'Pendiente']
                );
                documentosCreados++;
            } else {
                documentosExistentes++;
            }
        }

        console.log("\n================ RESULTADOS DEL ESCANEO COMPLETO ================");
        console.log(`Archivos PDF procesados: ${allPdfs.length}`);
        console.log(`Expedientes nuevos en BD: ${expedientesCreados}`);
        console.log(`Documentos nuevos registrados en BD: ${documentosCreados}`);
        console.log(`Documentos que ya existían en BD: ${documentosExistentes}`);

    } catch (err) {
        console.error("Error durante escaneo:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

syncAll();
