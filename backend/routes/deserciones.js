const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { pool } = require('../database_pg');
const db = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Configuración de almacenamiento para multer (Excel y Anexos PDF/Docs)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'deserciones');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
});

// Helper: asegurar que la tabla deserciones_casos exista
const ensureDesercionesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deserciones_casos (
                id SERIAL PRIMARY KEY,
                etapa VARCHAR(50) NOT NULL,
                ficha VARCHAR(50),
                programa TEXT,
                aprendiz_nombre TEXT,
                aprendiz_doc_tipo VARCHAR(20),
                aprendiz_doc_numero VARCHAR(50),
                aprendiz_correo TEXT,
                causal_desercion TEXT,
                fecha_comite VARCHAR(50),
                hora_comite VARCHAR(50),
                lugar_comite TEXT,
                texto_inicial TEXT,
                texto_combinado TEXT,
                comunicacion_pdf_path TEXT,
                anexo_path TEXT,
                onbase_target_user TEXT,
                copy_emails TEXT,
                nis VARCHAR(100),
                radicado VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.error('[DESERCIONES] Error asegurando tabla deserciones_casos:', e.message);
    }
};

ensureDesercionesTable();

router.use(requireAuth, requireAdmin);

// 0. Gestor de Correos en Copia (CC) Configurados Persistentes en Base de Datos
router.get('/cc-emails', requireAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_cc_emails'");
        if (result.rows && result.rows.length > 0 && result.rows[0].value) {
            try {
                const emails = JSON.parse(result.rows[0].value);
                return res.json({ cc_emails: emails });
            } catch (pErr) {
                console.warn('[DESERCIONES] Error parseando JSON de cc_emails:', pErr);
            }
        }
        const defaultEmails = [
            { name: 'Subdirección Centro', email: 'subdireccion_centro@sena.edu.co' },
            { name: 'Coordinación Académica', email: 'coordinacion_academica@sena.edu.co' }
        ];
        res.json({ cc_emails: defaultEmails });
    } catch (err) {
        console.error('[DESERCIONES] Error obteniendo correos CC:', err);
        res.status(500).json({ error: 'Error al consultar correos CC.' });
    }
});

router.post('/cc-emails', requireAuth, async (req, res) => {
    const { cc_emails } = req.body;
    if (!Array.isArray(cc_emails)) {
        return res.status(400).json({ error: 'El formato de correos CC debe ser una lista.' });
    }
    try {
        const valueStr = JSON.stringify(cc_emails);
        await pool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('sena_deserciones_cc_emails', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [valueStr]);

        res.json({ message: 'Correos en Copia (CC) guardados y almacenados exitosamente en el sistema.', cc_emails });
    } catch (err) {
        console.error('[DESERCIONES] Error guardando correos CC:', err);
        res.status(500).json({ error: 'Error al almacenar correos CC.' });
    }
});

// 1. Carga y parseo de Excel con registros de aprendices
router.post('/upload-excel', requireAuth, upload.single('excel'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha adjuntado ningún archivo Excel.' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parsear filas en JSON
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawData || rawData.length === 0) {
            return res.status(400).json({ error: 'El archivo Excel está vacío o no tiene un formato válido.' });
        }

        // Mapear y normalizar encabezados
        const columns = Object.keys(rawData[0] || {});
        
        const processedRows = rawData.map((row, index) => {
            // Normalización inteligente de campos comunes SENA
            const getVal = (possibleKeys) => {
                for (const k of possibleKeys) {
                    const keyFound = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim() || rk.toLowerCase().includes(k.toLowerCase()));
                    if (keyFound && row[keyFound] !== undefined && row[keyFound] !== null) {
                        return String(row[keyFound]).trim();
                    }
                }
                return '';
            };

            return {
                id_temp: `row-${index + 1}`,
                ficha: getVal(['ficha', 'num_ficha', 'numero_ficha', 'codigo_ficha']),
                programa: getVal(['programa', 'programa_formacion', 'nombre_programa']),
                aprendiz_nombre: getVal(['nombre', 'aprendiz', 'nombre_aprendiz', 'nombres_y_apellidos', 'nombre_completo']),
                aprendiz_doc_tipo: getVal(['tipo_doc', 'tipo_documento', 'td', 'tipo_id']) || 'CC',
                aprendiz_doc_numero: getVal(['documento', 'num_documento', 'identificacion', 'cedula', 'numero_documento']),
                aprendiz_correo: getVal(['correo', 'email', 'correo_aprendiz', 'mail', 'correo_electronico']),
                causal_desercion: getVal(['causal', 'causal_desercion', 'motivo', 'razon_desercion']),
                fecha_comite: getVal(['fecha_comite', 'fecha', 'fecha_citacion']),
                hora_comite: getVal(['hora_comite', 'hora', 'hora_citacion']),
                lugar_comite: getVal(['lugar_comite', 'lugar', 'enlace', 'ubicacion']),
                resolucion: getVal(['resolucion', 'resolución', 'num_resolucion', 'numero_resolucion', 'no_resolucion', 'no._resolucion', 'acto_administrativo', 'comunicacion']),
                raw_row: row
            };
        });

        res.json({
            message: 'Excel procesado exitosamente',
            filename: req.file.filename,
            filepath: req.file.path,
            columns: columns,
            total: processedRows.length,
            rows: processedRows
        });

    } catch (err) {
        console.error('[DESERCIONES] Error procesando Excel:', err);
        res.status(500).json({ error: `Error procesando el archivo Excel: ${err.message}` });
    }
});

// 2. Subida de Anexo Explícito (PDF/Doc) para citación a comité o resolución
router.post('/upload-anexo', requireAuth, upload.single('anexo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se adjuntó ningún archivo de anexo.' });
        }
        res.json({
            message: 'Anexo subido correctamente',
            originalName: req.file.originalname,
            path: req.file.path,
            filename: req.file.filename
        });
    } catch (err) {
        console.error('[DESERCIONES] Error subiendo anexo:', err);
        res.status(500).json({ error: 'Error al subir el archivo de anexo.' });
    }
});

// 2.1 Carga masiva de paquete de anexos (PDFs/Documentos en lote)
router.post('/upload-masivo-anexos', requireAuth, upload.array('anexos', 200), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se adjuntó ningún paquete de anexos.' });
        }
        const uploadedFiles = req.files.map(f => ({
            originalName: f.originalname,
            path: f.path,
            filename: f.filename
        }));

        res.json({
            message: `Se subieron ${uploadedFiles.length} archivos de anexos en paquete exitosamente.`,
            files: uploadedFiles
        });
    } catch (err) {
        console.error('[DESERCIONES] Error en carga masiva de anexos:', err);
        res.status(500).json({ error: 'Error procesando la carga masiva de anexos.' });
    }
});

// Helper de fusión de texto inicial con campos de fila
const mergeText = (template, row) => {
    if (!template) return '';
    let merged = template;
    
    const replacements = {
        'aprendiz_nombre': row.aprendiz_nombre || '',
        'aprendiz_doc_tipo': row.aprendiz_doc_tipo || 'CC',
        'aprendiz_doc_numero': row.aprendiz_doc_numero || '',
        'ficha': row.ficha || '',
        'programa': row.programa || '',
        'aprendiz_correo': row.aprendiz_correo || '',
        'causal_desercion': row.causal_desercion || '',
        'fecha_comite': row.fecha_comite || '',
        'hora_comite': row.hora_comite || '',
        'lugar_comite': row.lugar_comite || '',
        'fecha_actual': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    // Reemplazo dinámico de variables predefinidas en múltiples sintaxis
    Object.keys(replacements).forEach(key => {
        const val = replacements[key];
        const escKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const patterns = [
            new RegExp(`\\{\\{\\s*${escKey}\\s*\\}\\}`, 'gi'),
            new RegExp(`«\\s*${escKey}\\s*[_.]*\\s*»`, 'gi'),
            new RegExp(`<<\\s*${escKey}\\s*>>`, 'gi'),
            new RegExp(`\\[\\s*${escKey}\\s*\\]`, 'gi')
        ];
        patterns.forEach(p => { merged = merged.replace(p, val); });
    });

    // Reemplazo de variables genéricas de columnas del Excel (ej. {{DOCUMENTO}}, «DOCUMENTO_», etc.)
    if (row.raw_row && typeof row.raw_row === 'object') {
        Object.keys(row.raw_row).forEach(colKey => {
            const val = row.raw_row[colKey] !== undefined && row.raw_row[colKey] !== null ? String(row.raw_row[colKey]) : '';
            const escCol = colKey.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            
            const patterns = [
                new RegExp(`\\{\\{\\s*${escCol}\\s*\\}\\}`, 'gi'),
                new RegExp(`«\\s*${escCol}\\s*[_.]*\\s*»`, 'gi'),
                new RegExp(`<<\\s*${escCol}\\s*>>`, 'gi'),
                new RegExp(`\\[\\s*${escCol}\\s*\\]`, 'gi')
            ];

            patterns.forEach(pattern => {
                merged = merged.replace(pattern, val);
            });
        });
    }

    return merged;
};

// 3. Vista previa de correspondencia combinada
router.post('/preview-merge', requireAuth, (req, res) => {
    const { template, row } = req.body;
    if (!row) {
        return res.status(400).json({ error: 'Datos de registro requeridos para la vista previa.' });
    }

    const merged = mergeText(template, row);
    res.json({ mergedText: merged });
});

// 4. Guardar casos y preparar comunicaciones (opcionalmente generando PDF o directo para robot OnBase)
router.post('/guardar-casos', requireAuth, async (req, res) => {
    const { etapa, casos, texto_inicial, onbase_target_user, copy_emails, generate_pdf = true } = req.body;

    if (!etapa || !casos || !Array.isArray(casos) || casos.length === 0) {
        return res.status(400).json({ error: 'Datos de casos incompletos o inválidos.' });
    }

    try {
        await ensureDesercionesTable();

        const copyEmailsStr = typeof copy_emails === 'string' ? copy_emails : JSON.stringify(copy_emails || []);
        const outputDir = path.join(__dirname, '..', 'uploads', 'deserciones_pdf');
        if (generate_pdf && !fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        let browser = null;
        if (generate_pdf) {
            try {
                browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            } catch (e) {
                console.warn('[DESERCIONES] Advertencia lanzando Puppeteer:', e.message);
            }
        }

        const createdRecords = [];

        for (const item of casos) {
            const textoCombinado = mergeText(texto_inicial, item);
            let pdfPath = '';

            // Generar PDF usando Puppeteer si está disponible
            if (browser) {
                try {
                    const page = await browser.newPage();
                    const htmlContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 40px; color: #222; }
                                .header { text-align: center; border-bottom: 2px solid #39a900; padding-bottom: 15px; margin-bottom: 25px; }
                                .header img { width: 90px; }
                                .title { font-size: 14pt; font-weight: bold; color: #00324d; margin-top: 10px; }
                                .ref { font-size: 10pt; text-align: right; margin-bottom: 20px; color: #555; }
                                .recipient { font-weight: bold; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-left: 4px solid #39a900; }
                                .content { white-space: pre-wrap; text-align: justify; margin-bottom: 40px; }
                                .footer { text-align: center; font-size: 9pt; color: #777; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 50px; }
                            </style>
                        </head>
                        <body>
                            <div class="header">
                                <div class="title">SERVICIO NACIONAL DE APRENDIZAJE - SENA</div>
                                <div>COMUNICACIÓN OFICIAL - PROCESO DE DESERCIÓN (${etapa === 'CITACION_COMITE' ? 'CITACIÓN A COMITÉ' : 'NOTIFICACIÓN DE RESOLUCIÓN'})</div>
                            </div>
                            <div class="ref">
                                Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}
                            </div>
                            <div class="recipient">
                                Señor(a): ${item.aprendiz_nombre || 'APRENDIZ'}<br>
                                Documento: ${item.aprendiz_doc_tipo || 'CC'} ${item.aprendiz_doc_numero || ''}<br>
                                Ficha: ${item.ficha || 'N/A'} - Programa: ${item.programa || 'N/A'}<br>
                                Correo: ${item.aprendiz_correo || 'N/A'}
                            </div>
                            <div class="content">
                                ${textoCombinado}
                            </div>
                            <div class="footer">
                                SENA - Centro de Formación Profesional - Dirección General
                            </div>
                        </body>
                        </html>
                    `;

                    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
                    const fileName = `Comunicacion_${etapa}_${item.aprendiz_doc_numero || Date.now()}_${Date.now()}.pdf`;
                    pdfPath = path.join(outputDir, fileName);
                    await page.pdf({ path: pdfPath, format: 'Letter', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } });
                    await page.close();
                } catch (pdfErr) {
                    console.error('[DESERCIONES] Error generando PDF individual:', pdfErr);
                }
            }

            // Insertar registro en la base de datos
            const queryRes = await pool.query(`
                INSERT INTO deserciones_casos (
                    etapa, ficha, programa, aprendiz_nombre, aprendiz_doc_tipo, aprendiz_doc_numero,
                    aprendiz_correo, causal_desercion, fecha_comite, hora_comite, lugar_comite,
                    texto_inicial, texto_combinado, comunicacion_pdf_path, anexo_path,
                    onbase_target_user, copy_emails, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Pendiente')
                RETURNING *
            `, [
                etapa,
                item.ficha || '',
                item.programa || '',
                item.aprendiz_nombre || '',
                item.aprendiz_doc_tipo || 'CC',
                item.aprendiz_doc_numero || '',
                item.aprendiz_correo || '',
                item.causal_desercion || '',
                item.fecha_comite || '',
                item.hora_comite || '',
                item.lugar_comite || '',
                texto_inicial || '',
                textoCombinado,
                pdfPath,
                item.anexo_path || '',
                onbase_target_user || '',
                copyEmailsStr
            ]);

            if (queryRes.rows && queryRes.rows[0]) {
                createdRecords.push(queryRes.rows[0]);
            }
        }

        if (browser) {
            await browser.close();
        }

        res.json({
            message: `Se han procesado y guardado ${createdRecords.length} comunicaciones de deserción correctamente.`,
            casos: createdRecords
        });

    } catch (err) {
        console.error('[DESERCIONES] Error al guardar casos:', err);
        res.status(500).json({ error: `Error al procesar los casos de deserción: ${err.message}` });
    }
});

// 5. Consultar casos de deserciones registrados
router.get('/casos', requireAuth, async (req, res) => {
    const { etapa, status, ficha } = req.query;
    try {
        await ensureDesercionesTable();
        let query = 'SELECT * FROM deserciones_casos WHERE 1=1';
        const params = [];

        if (etapa) {
            params.push(etapa);
            query += ` AND etapa = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        if (ficha) {
            params.push(`%${ficha}%`);
            query += ` AND ficha ILIKE $${params.length}`;
        }

        query += ' ORDER BY id DESC LIMIT 500';

        const result = await pool.query(query, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[DESERCIONES] Error consultando casos:', err);
        res.status(500).json({ error: 'Error consultando casos de deserción.' });
    }
});

// 6. Cargar casos seleccionados hacia OnBase Web
router.post('/cargue-onbase', requireAuth, async (req, res) => {
    const { caso_ids } = req.body;
    if (!caso_ids || !Array.isArray(caso_ids) || caso_ids.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un caso para realizar el cargue a OnBase.' });
    }

    try {
        await ensureDesercionesTable();
        const idsPlaceholder = caso_ids.map((_, i) => `$${i + 1}`).join(',');
        const queryRes = await pool.query(
            `SELECT * FROM deserciones_casos WHERE id IN (${idsPlaceholder})`,
            caso_ids
        );

        const casosToLoad = queryRes.rows;

        // Actualizamos estado a 'Cargado' y fecha de actualización
        await pool.query(
            `UPDATE deserciones_casos SET status = 'Cargado', updated_at = CURRENT_TIMESTAMP WHERE id IN (${idsPlaceholder})`,
            caso_ids
        );

        res.json({
            message: `Proceso de cargue iniciado exitosamente a OnBase Web para ${casosToLoad.length} comunicaciones.`,
            casos_cargados: casosToLoad
        });

    } catch (err) {
        console.error('[DESERCIONES] Error procesando cargue a OnBase:', err);
        res.status(500).json({ error: `Error realizando el cargue a OnBase: ${err.message}` });
    }
});

// 7. Limpiar/vaciar histórico de casos de prueba
router.post('/limpiar-casos', requireAuth, async (req, res) => {
    try {
        await ensureDesercionesTable();
        await pool.query('TRUNCATE TABLE deserciones_casos RESTART IDENTITY;');
        res.json({ message: 'El histórico de casos de prueba se ha limpiado correctamente.' });
    } catch (err) {
        console.error('[DESERCIONES] Error limpiando casos:', err);
        res.status(500).json({ error: 'Error al vaciar el histórico de casos.' });
    }
});

module.exports = router;
