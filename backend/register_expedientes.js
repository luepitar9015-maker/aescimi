require('dotenv').config();
const { pool } = require('./database_pg');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const fs = require('fs');

const EXCEL_PATH = 'C:\\Users\\Usuario\\Downloads\\Plantilla Creacion Masivo Expedientes AES emprendimiento (4).xlsx';

async function run() {
    console.log("=== INICIANDO REGISTRO DE EXPEDIENTES ===");
    
    // 1. Asegurar la existencia de Viviana Paola Villamizar Aceros en la base de datos
    let vivianaId = null;
    try {
        const userCheck = await pool.query(
            "SELECT id FROM users WHERE full_name ILIKE $1 OR document_no = $2",
            ['%Viviana Paola Villamizar Aceros%', '1000000000']
        );
        
        if (userCheck.rowCount > 0) {
            vivianaId = userCheck.rows[0].id;
            console.log(`[USER] Viviana Paola Villamizar Aceros ya existe con ID: ${vivianaId}`);
        } else {
            console.log("[USER] Registrando usuario para Viviana Paola Villamizar Aceros...");
            const salt = bcrypt.genSaltSync(10);
            const passwordHash = bcrypt.hashSync('Viviana2026**', salt);
            
            const insertUser = await pool.query(
                `INSERT INTO users (full_name, area, position, document_no, password_hash, email, role, must_change_password) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    'Viviana Paola Villamizar Aceros',
                    'Emprendimiento',
                    'Gestor de Proyectos',
                    '1000000000', // Cédula temporal/placeholder
                    passwordHash,
                    'viviana.villamizar@sena.edu.co',
                    'user',
                    1
                ]
            );
            vivianaId = insertUser.rows[0].id;
            console.log(`[USER] Usuario creado con ID: ${vivianaId} y cédula 1000000000`);
        }
    } catch (e) {
        console.error("Error asegurando usuario de Viviana:", e);
        process.exit(1);
    }

    // 2. Leer archivo Excel
    if (!fs.existsSync(EXCEL_PATH)) {
        console.error(`No se encontró el archivo Excel en: ${EXCEL_PATH}`);
        process.exit(1);
    }
    
    let rows = [];
    try {
        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
        console.log(`[EXCEL] Leídos ${rows.length} registros del archivo.`);
    } catch (e) {
        console.error("Error leyendo Excel:", e);
        process.exit(1);
    }

    // 3. Helper para normalizar fecha de Excel (ej: 46101)
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

    // 4. Registrar expedientes y asignarlos
    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const projectName = String(row['Valor1'] || '').trim();
        
        if (!projectName) {
            console.warn(`[REGISTRO] Fila ${i+1} omitida porque la columna 'Valor1' (nombre del proyecto) está vacía.`);
            continue;
        }

        const subserie = String(row['Subserie'] || '68.9224.4-53.21').trim();
        const openingDate = normalizeDate(row['Fecha Apertura']);
        const storageType = String(row['Tipo Almacenamiento'] || 'ELECTRÓNICO').trim();
        const boxId = String(row['Id Caja'] || '').trim() || null;
        
        // Metadatos
        const metadataValues = {
            valor1: projectName,
            valor2: String(row['Valor2'] || '2026').trim(),
            valor3: String(row['Valor3'] || '').trim(),
            valor4: String(row['Valor4'] || '').trim(),
            valor5: String(row['Valor5'] || '').trim(),
            valor6: String(row['Valor6'] || '').trim(),
            valor7: String(row['Valor7'] || '').trim(),
            valor8: String(row['Valor8'] || '').trim()
        };

        try {
            // Verificar si ya existe por título o valor1 en metadatos para evitar duplicar
            const dupCheck = await pool.query(
                `SELECT id FROM expedientes WHERE title = $1 OR (metadata_values::jsonb)->>'valor1' = $2`,
                [projectName, projectName]
            );
            
            let expId = null;
            if (dupCheck.rowCount > 0) {
                expId = dupCheck.rows[0].id;
                console.log(`[EXPEDIENTE] "${projectName}" ya existe con ID: ${expId}. Se omitirá la creación.`);
            } else {
                // Crear el expediente
                const insertExp = await pool.query(
                    `INSERT INTO expedientes 
                     (expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                    [
                        null, // El código de expediente se inyectará después desde OnBase
                        boxId,
                        openingDate,
                        subserie,
                        'REGIONAL SANTANDER',
                        'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL',
                        'SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL',
                        storageType,
                        projectName, // Usamos Valor1 como título
                        JSON.stringify(metadataValues)
                    ]
                );
                expId = insertExp.rows[0].id;
                console.log(`[EXPEDIENTE] Fila ${i+1}: Creado expediente "${projectName}" con ID: ${expId}`);
                successCount++;
            }

            // Crear o actualizar la asignación para Viviana
            await pool.query(
                `INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (expediente_id, user_id) DO NOTHING`,
                [expId, vivianaId, null, 'Asignado a Viviana Paola Villamizar Aceros en registro de creación masiva']
            );
            console.log(`[ASIGNACIÓN] Expediente ID ${expId} asignado correctamente a Viviana.`);

        } catch (e) {
            console.error(`Error procesando fila ${i+1} (${projectName}):`, e.message);
        }
    }

    console.log(`\n=== REGISTRO COMPLETADO ===`);
    console.log(`Total expedientes creados en esta corrida: ${successCount}`);
    
    await pool.end();
}

run().catch(console.error);
