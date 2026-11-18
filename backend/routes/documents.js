const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const db = require('../database');
const sharp = require('sharp');
const { requireAuth } = require('../middleware/authMiddleware');

// Auto-schema migration for multi-expediente relational document sharing & folio counting
(async () => {
    try {
        const { pool: pgPool } = require('../database_pg');
        await pgPool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS shared_group_id TEXT');
        await pgPool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_document_id INTEGER');
        await pgPool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_count INTEGER');
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_documents_shared_group ON documents(shared_group_id)');
        await pgPool.query('CREATE INDEX IF NOT EXISTS idx_documents_user_created ON documents(user_id, created_at)');
    } catch (e) {
        console.warn('[DOCUMENTS SCHEMA] Warning ensuring columns:', e.message);
    }
})();

const linkOrCopyFileSync = (srcPath, dstPath) => {
    const dstDir = path.dirname(dstPath);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    if (fs.existsSync(dstPath)) {
        try { fs.unlinkSync(dstPath); } catch (_) {}
    }
    try {
        fs.linkSync(srcPath, dstPath);
    } catch (_) {
        fs.copyFileSync(srcPath, dstPath);
    }
};

// Configure Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// POST /upload - Process and Save Document
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { split, origen = 'DIGITALIZADO' } = req.body;
    
    try {
        const expediente = JSON.parse(req.body.expediente || '{}');
        const typologies = JSON.parse(req.body.typology || '[]'); 
        // typologies format: [{ name: 'TypologyName', range: '1-3' }]

        // 1. LOOKUP TRD CODES AND STORAGE PATH
        const getTRDInfo = () => new Promise((resolve, reject) => {
            if (expediente && expediente.id) {
                const query = `
                    SELECT 
                        sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
                        ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                        org.section_code, org.subsection_code, org.regional_code, org.center_code,
                        org.storage_path, org.entity_name, org.regional_name, org.center_name,
                        ser.id as series_id, sub.id as id, org.id as dependency_id
                    FROM expedientes e
                    LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                    LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
                    LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                    WHERE e.id = ?
                    LIMIT 1
                `;
                db.get(query, [expediente.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            } else {
                const query = `
                    SELECT 
                        s.subseries_code, s.subseries_name, s.folder_hierarchy as sub_hierarchy,
                        ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                        org.section_code, org.subsection_code, org.regional_code, org.center_code,
                        org.storage_path, org.entity_name, org.regional_name, org.center_name,
                        ser.id as series_id, s.id as id, org.id as dependency_id
                    FROM trd_subseries s
                    LEFT JOIN trd_series ser ON s.series_id = ser.id
                    LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                    WHERE s.subseries_code = ? OR s.subseries_name = ?
                    LIMIT 1
                `;
                db.get(query, [expediente.subserie, expediente.subserie], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            }
        });

        const trdInfo = await getTRDInfo();

        // GRANULAR PERMISSIONS CHECK
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            const checkPerm = () => new Promise((resolve) => {
                const checkTrd = () => {
                    if (!trdInfo) return resolve(false);
                    const q = `
                        SELECT can_upload FROM user_trd_permissions 
                        WHERE user_id = $1 AND (series_id = $2 OR subseries_id = $3)
                        ORDER BY can_upload DESC LIMIT 1
                    `;
                    db.get(q, [req.user.id, trdInfo.series_id || null, trdInfo.id || null], (err, row) => {
                        resolve(row ? row.can_upload === 1 : false);
                    });
                };

                if (expediente && expediente.id) {
                    db.get(
                        `SELECT 1 AS assigned FROM expediente_assignments WHERE expediente_id = $1 AND user_id = $2 LIMIT 1`,
                        [expediente.id, req.user.id],
                        (assignErr, assignRow) => {
                            if (!assignErr && assignRow) return resolve(true);
                            checkTrd();
                        }
                    );
                } else {
                    checkTrd();
                }
            });
            const hasPerm = await checkPerm();
            if (!hasPerm) {
                return res.status(403).json({ error: 'No tiene permisos para cargar documentos en esta Serie/Subserie.' });
            }
        }

        // Helper to get system setting
        const getSystemSetting = (key) => new Promise((resolve) => {
            db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => {
                if (err || !row) resolve(null);
                else resolve(row.value);
            });
        });

        const globalHierarchy = await getSystemSetting('folder_hierarchy');
        let hierarchy = [];
        try {
            const raw = trdInfo?.sub_hierarchy || trdInfo?.ser_hierarchy || globalHierarchy;
            hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
        } catch (e) { hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }]; }

        // Metadata labels (Nivel 6, 7...)
        let metaValues = {};
        try {
            metaValues = typeof expediente.metadata_values === 'string'
                ? JSON.parse(expediente.metadata_values || '{}')
                : (expediente.metadata_values || {});
        } catch (e) { metaValues = {}; }

        // Helper to extract suffixes without symbols
        const getCleanSuffix = (fullCode, separator) => {
            if (!fullCode) return '';
            const parts = String(fullCode).split(separator);
            return parts[parts.length - 1].replace(/[.-]/g, '');
        };

        const regCode = trdInfo?.regional_code || '68';
        const ctrCode = trdInfo?.center_code || '9224';
        const serieSuffix = getCleanSuffix(trdInfo?.series_code, '-');
        const subserieSuffix = getCleanSuffix(trdInfo?.subseries_code, '.');

        const basePath = process.env.LOCAL_STORAGE_PATH || (await getSystemSetting('storage_path')) || trdInfo?.storage_path || path.join(__dirname, '../uploads/Gestion_Documental');
        const backupBasePath = await getSystemSetting('backup_path');

        // Function to build path dynamically based on typology name
        const buildPathsForTypology = async (typologyName) => {
            const getTypologyMapping = (name) => new Promise((resolve) => {
                db.get("SELECT document_type_value FROM trd_typologies WHERE typology_name = ?", [name], (err, row) => {
                    resolve(row?.document_type_value || null);
                });
            });
            const typValue = await getTypologyMapping(typologyName);

            const rawLevels = hierarchy.map(level => {
                let value = '';
                const type = level.type;

                if (type === 'reg') value = regCode;
                else if (type === 'ctr') value = ctrCode;
                else if (type === 'dep') value = trdInfo?.section_code || trdInfo?.subsection_code || 'DEP';
                else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
                else if (type === 'ser') value = trdInfo?.series_code || 'SERIE';
                else if (type === 'ser_name') value = trdInfo?.series_name || 'SERIE';
                else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
                else if (type === 'sub') value = trdInfo?.subseries_code || 'SUBSERIE';
                else if (type === 'sub_name') value = trdInfo?.subseries_name || 'SUBSERIE';
                else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
                else if (type === 'typ_val') value = String(typValue || '');
                else if (type === 'meta_1') {
                    const raw = expediente.title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
                    // Bloquear el literal genérico — no debe ser un nombre de carpeta
                    value = (raw.trim() === 'Sin Título') ? '' : raw;
                }
                else if (type.startsWith('meta_')) {
                    const idx = type.split('_')[1];
                    value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '';
                }
                
                return String(value || '')
                    .replace(/[.-]/g, '')
                    .replace(/[<>:"/\\|?*]/g, '') 
                    .trim();
            });

            // ── GUARDIA CRÍTICA: Detectar si algún nivel obligatorio quedó vacío ──
            // Si el nivel de título (meta_1) está vacío, el expediente no tiene nombre
            // y se crearía una carpeta sin nombre o con nombre incorrecto en OneDrive.
            const meta1Index = hierarchy.findIndex(h => h.type === 'meta_1');
            if (meta1Index !== -1 && (!rawLevels[meta1Index] || rawLevels[meta1Index].trim() === '')) {
                throw new Error(
                    `El expediente "${expediente.title || '(sin título)'}" no tiene título válido. ` +
                    `No se puede crear la carpeta en el almacenamiento. ` +
                    `Edite el expediente y asigne un título antes de cargar documentos.`
                );
            }

            const pathParts = rawLevels.filter(v => v.trim() !== '');
            const expDir = path.join(basePath, ...pathParts);

            if (!fs.existsSync(expDir)) {
                fs.mkdirSync(expDir, { recursive: true });
            }

            let backupExpDir = null;
            if (backupBasePath && backupBasePath.trim() !== '') {
                backupExpDir = path.join(backupBasePath, ...pathParts);
                if (!fs.existsSync(backupExpDir)) {
                    try { fs.mkdirSync(backupExpDir, { recursive: true }); } 
                    catch (e) { console.error("[BACKUP] Error creating dir:", e); backupExpDir = null; }
                }
            }

            return { expDir, backupExpDir, pathParts };
        };

        const sourcePath = req.file.path;
        let sourcePdfBytes = fs.readFileSync(sourcePath);
        
        // AUTO-CONVERT IMAGES TO PDF if needed
        const ext = path.extname(req.file.originalname).toLowerCase().trim();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
        
        if (imageExtensions.includes(ext)) {
            console.log(`[CONVERSION] Detected image file: ${ext}. Converting to PDF...`);
            try {
                const pdfDocTemp = await PDFDocument.create();
                
                if (ext === '.tif' || ext === '.tiff') {
                    const metadata = await sharp(sourcePath).metadata();
                    const pages = metadata.pages || 1;
                    console.log(`[CONVERSION] multi-page TIFF: ${pages} pages`);
                    
                    for (let i = 0; i < pages; i++) {
                        const pageBuffer = await sharp(sourcePath, { page: i }).jpeg().toBuffer();
                        const image = await pdfDocTemp.embedJpg(pageBuffer);
                        const pdfPage = pdfDocTemp.addPage([image.width, image.height]);
                        pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                    }
                } else {
                    const image = ext === '.png' ? await pdfDocTemp.embedPng(sourcePdfBytes) : await pdfDocTemp.embedJpg(sourcePdfBytes);
                    const page = pdfDocTemp.addPage([image.width, image.height]);
                    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                }
                
                sourcePdfBytes = await pdfDocTemp.save();
                console.log(`[CONVERSION] Successfully created PDF buffer. Size: ${sourcePdfBytes.length} bytes`);
            } catch (convErr) {
                console.error("[CONVERSION] Error during image to PDF conversion:", convErr);
                throw new Error(`Error al convertir la imagen a PDF: ${convErr.message}`);
            }
        }

        // Load the PDF into pdf-lib (either the original PDF or the converted one)
        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
        } catch (loadErr) {
            console.error("Error loading PDF in pdf-lib:", loadErr);
            throw new Error(`El archivo no es un PDF válido o la conversión falló: ${loadErr.message}`);
        }

        const results = [];
        const documentDate = req.body.document_date || new Date().toISOString();

        const getTypologyOrderMap = async (seriesId, subseriesId) => {
            return new Promise((resolve) => {
                let q, params;
                if (subseriesId) {
                    q = "SELECT typology_name FROM trd_typologies WHERE subseries_id = ? ORDER BY id ASC";
                    params = [subseriesId];
                } else if (seriesId) {
                    q = "SELECT typology_name FROM trd_typologies WHERE series_id = ? ORDER BY id ASC";
                    params = [seriesId];
                } else {
                    return resolve({});
                }
                
                db.all(q, params, (err, rows) => {
                    const map = {};
                    if (!err && rows) {
                        rows.forEach((r, idx) => {
                            const normalized = r.typology_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                            map[normalized] = idx + 1; // 1-based index
                        });
                    }
                    resolve(map);
                });
            });
        };

        const typologyOrderMap = await getTypologyOrderMap(trdInfo?.series_id, trdInfo?.id);

        // Helper to generate filename: Uses TRD order (e.g. 01_Acta, 02_Informe) or user-confirmed customFilename
        const generateFilename = (typName, currentDocIndex, customName = null) => {
            if (customName && String(customName).trim() !== '') {
                let cleanCustom = String(customName).replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*]/g, '').trim();
                if (cleanCustom) {
                    return `${cleanCustom}.pdf`;
                }
            }
            const safeName = typName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
            const normalizedTypName = typName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            const trdOrder = typologyOrderMap[normalizedTypName] || 99; // Fallback a 99 si no está en TRD
            const paddedOrder = String(trdOrder).padStart(2, '0');
            
            // Si hay múltiples documentos de la misma tipología, se agrega un sufijo _2, _3
            if (currentDocIndex > 1) {
                return `${paddedOrder}_${safeName}_${currentDocIndex}.pdf`;
            }
            return `${paddedOrder}_${safeName}.pdf`;
        };

        // Helper to save document to DB
        const saveToDb = (filename, filePath, typologyName, descriptionText = null, customDate = null, customOrigen = null, pageCount = null) => {
            return new Promise((resolve, reject) => {
                const query = `INSERT INTO documents (
                    organization_id, trd_series_id, trd_subseries_id, expediente_id,
                    filename, path, typology_name, document_date, origen, metadata_values, user_id, page_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                
                // Note: We use IDs from trdInfo if available, and expediente.id
                db.run(query, [
                    trdInfo?.dependency_id || null,
                    trdInfo?.series_id || null,
                    trdInfo?.id || null, // subseries_id
                    expediente.id || null, // Ensure string if storing string, but it's integer column usually
                    filename,
                    filePath,
                    typologyName,
                    customDate || documentDate,
                    customOrigen || origen,
                    descriptionText ? JSON.stringify({ description: descriptionText }) : null,
                    req.user?.id || null,
                    pageCount
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        };

        // Query current document count for EACH typology in this expediente
        const getTypologyCountMap = () => {
            return new Promise((resolve) => {
                const countQ = "SELECT typology_name, COUNT(id) as total FROM documents WHERE expediente_id = ? GROUP BY typology_name";
                db.all(countQ, [expediente.id], (err, rows) => {
                    const map = {};
                    if (!err && rows) {
                        rows.forEach(r => map[r.typology_name] = r.total);
                    }
                    resolve(map);
                });
            });
        };

        let typologyCounts = await getTypologyCountMap();
        let firstExpDir = null;

        if (split === 'true' && typologies.length > 0) {
            // Processing Split
            for (const typ of typologies) {
                const rangeParts = typ.range.split('-').map(Number);
                const start = rangeParts[0] - 1;
                const end = (rangeParts[1] || rangeParts[0]) - 1;

                const { expDir, backupExpDir, pathParts } = await buildPathsForTypology(typ.name);
                if (!firstExpDir) firstExpDir = expDir;
                
                console.log(`[UPLOAD] ✅ Niveles resueltos (${typ.name}):`, pathParts.join(' > '));
                console.log(`[UPLOAD] ✅ Directorio final (${typ.name}):`, expDir);

                const newPdf = await PDFDocument.create();
                const numPages = pdfDoc.getPageCount();
                
                const startIdx = Math.max(0, start);
                const endIdx = Math.min(numPages - 1, end);
                
                if (startIdx <= endIdx) {
                    const copiedPages = await newPdf.copyPages(pdfDoc, Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx + i));
                    copiedPages.forEach(page => newPdf.addPage(page));
                }
                
                typologyCounts[typ.name] = (typologyCounts[typ.name] || 0) + 1;
                const filename = generateFilename(typ.name, typologyCounts[typ.name], typ.custom_filename);
                const outputPath = path.join(expDir, filename);
                const pdfBytes = await newPdf.save();
                fs.writeFileSync(outputPath, pdfBytes);
                
                if (backupExpDir) {
                    try {
                        const backupFilePath = path.join(backupExpDir, filename);
                        fs.writeFileSync(backupFilePath, pdfBytes);
                        console.log(`[BACKUP] Copia guardada en: ${backupFilePath}`);
                    } catch (e) {
                        console.error("[BACKUP] Error guardando copia:", e);
                    }
                }
                
                // Save record to DB with individual typology date and origen
                const typDocDate = typ.document_date || documentDate;
                const typOrigen = typ.origen || origen;
                await saveToDb(filename, outputPath, typ.name, typ.description, typDocDate, typOrigen, newPdf.getPageCount());
                
                results.push({ file: filename, path: outputPath });
            }
        } else {
            // No Split - Save entire document (from pdfDoc to include any conversion)
            const mainTypology = typologies[0] ? typologies[0].name : 'Documento_General';
            const mainDescription = typologies[0] ? typologies[0].description : null;
            const mainCustomFilename = typologies[0] ? typologies[0].custom_filename : null;
            
            const { expDir, backupExpDir, pathParts } = await buildPathsForTypology(mainTypology);
            firstExpDir = expDir;
            
            console.log(`[UPLOAD] ✅ Niveles resueltos (${mainTypology}):`, pathParts.join(' > '));
            console.log(`[UPLOAD] ✅ Directorio final (${mainTypology}):`, expDir);
            
            typologyCounts[mainTypology] = (typologyCounts[mainTypology] || 0) + 1;
            const filename = generateFilename(mainTypology, typologyCounts[mainTypology], mainCustomFilename);
            const outputPath = path.join(expDir, filename);
            
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
            
            if (backupExpDir) {
                try {
                    const backupFilePath = path.join(backupExpDir, filename);
                    fs.writeFileSync(backupFilePath, pdfBytes);
                    console.log(`[BACKUP] Copia guardada en: ${backupFilePath}`);
                } catch (e) {
                    console.error("[BACKUP] Error guardando copia:", e);
                }
            }
            
            // Save record to DB
            await saveToDb(filename, outputPath, mainTypology, mainDescription, null, null, pdfDoc.getPageCount());
            
            results.push({ file: filename, path: outputPath });
        }

        // Clean up temp file
        fs.unlinkSync(sourcePath);

        // AUTO-ASIGNACIÓN: si el usuario tiene el expediente en un paquete, asignarlo
        if (req.user && expediente.id) {
            try {
                const { pool: pgPool } = require('../database_pg');
                const pkg = await pgPool.query(`
                    SELECT p.id FROM paquete_items pi
                    JOIN expediente_paquetes p ON p.id = pi.paquete_id
                    WHERE pi.expediente_id = $1 AND p.user_id = $2 LIMIT 1
                `, [expediente.id, req.user.id]);
                if (pkg.rowCount > 0) {
                    const paqId = pkg.rows[0].id;
                    await pgPool.query(`
                        INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, paquete_id, estado, observaciones)
                        VALUES ($1,$2,$2,$3,'En Proceso','Auto-asignado al cargar documento')
                        ON CONFLICT (expediente_id, user_id) DO UPDATE SET estado='En Proceso', assigned_at=CURRENT_TIMESTAMP
                    `, [expediente.id, req.user.id, paqId]);
                    console.log(`[AUTO-ASIGN] Expediente ${expediente.id} auto-asignado a usuario ${req.user.id}`);
                }
            } catch (autoErr) {
                console.warn('[AUTO-ASIGN] Error (no crítico):', autoErr.message);
            }
        }

        res.json({ success: true, files: results, storage_path: firstExpDir });

    } catch (err) {
        console.error("Error processing document:", err);
        res.status(500).json({ error: err.message });
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
});

// GET / - List all saved documents (most recent first)
// GET list all saved documents (with expediente info)
router.get('/', (req, res) => {
    const statusFilter = (req.query.status || '').trim();
    const dateFilter = (req.query.filter || '').trim();
    const assignedOnly = req.query.assigned_only === '1' || req.query.assigned_only === 'true';
    const searchQ = (req.query.q || '').trim();

    const extraConditions = [];
    if (statusFilter === 'Pendiente') {
        extraConditions.push(`(d.status IS NULL OR d.status != 'Cargado')`);
    } else if (statusFilter === 'Cargado') {
        extraConditions.push(`d.status = 'Cargado'`);
    }
    if (dateFilter === 'hoy') {
        extraConditions.push(`(DATE(d.load_date) = CURRENT_DATE OR DATE(d.created_at) = CURRENT_DATE)`);
    }
    if (assignedOnly && req.user && req.user.id) {
        const uid = Number(req.user.id);
        extraConditions.push(`(d.expediente_id IN (SELECT expediente_id FROM expediente_assignments WHERE user_id = ${uid}) OR d.user_id = ${uid})`);
    }
    if (searchQ) {
        const safeLike = `%${searchQ.replace(/'/g, "''")}%`;
        extraConditions.push(`(
            d.filename ILIKE '${safeLike}'
            OR COALESCE(d.typology_name, '') ILIKE '${safeLike}'
            OR COALESCE(e.title, '') ILIKE '${safeLike}'
            OR COALESCE(e.expediente_code, '') ILIKE '${safeLike}'
            OR COALESCE(e.subserie, '') ILIKE '${safeLike}'
            OR COALESCE(CAST(e.metadata_values AS TEXT), '') ILIKE '${safeLike}'
        )`);
    }

    const adminWhere = extraConditions.length > 0 ? `WHERE ${extraConditions.join(' AND ')}` : '';
    const userExtraAnd = extraConditions.length > 0 ? `AND ${extraConditions.join(' AND ')}` : '';
    const limitClause = (statusFilter || dateFilter || assignedOnly || searchQ) ? 'LIMIT 500' : 'LIMIT 200';

    const query = `
        SELECT 
            d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.load_date, d.created_at, d.origen, d.metadata_values,
            d.expediente_id, d.shared_group_id, d.source_document_id,
            CASE WHEN d.shared_group_id IS NOT NULL THEN (SELECT COUNT(*)::int FROM documents ds WHERE ds.shared_group_id = d.shared_group_id) ELSE 1 END AS shared_count,
            e.title as expediente_title, e.expediente_code, e.subserie, e.metadata_values as expediente_metadata,
            sub.subseries_name, ser.series_name,
            org.section_name, org.subsection_name
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
        LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
        LEFT JOIN organization_structure org ON d.organization_id = org.id
        ${adminWhere}
        GROUP BY d.id, e.id, sub.id, ser.id, org.id
        ORDER BY d.created_at DESC
        ${limitClause}
    `;
    
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
            
            const seriesIds = (perms || []).map(p => p.series_id).filter(Boolean);
            const subseriesIds = (perms || []).map(p => p.subseries_id).filter(Boolean);
            
            const paramSeriesIds = seriesIds.length > 0 ? seriesIds : [-1];
            const paramSubseriesIds = subseriesIds.length > 0 ? subseriesIds : [-1];
            
            const filteredQuery = `
                SELECT 
                    d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.load_date, d.created_at, d.origen, d.metadata_values,
                    d.expediente_id, d.shared_group_id, d.source_document_id,
                    CASE WHEN d.shared_group_id IS NOT NULL THEN (SELECT COUNT(*)::int FROM documents ds WHERE ds.shared_group_id = d.shared_group_id) ELSE 1 END AS shared_count,
                    COALESCE(NULLIF(TRIM(e.title), ''), sub.subseries_name, ser.series_name) as expediente_title,
                    e.expediente_code, e.subserie, e.metadata_values as expediente_metadata,
                    sub.subseries_name, ser.series_name,
                    org.section_name, org.subsection_name
                FROM documents d
                LEFT JOIN expedientes e ON d.expediente_id = e.id
                LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
                LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
                LEFT JOIN organization_structure org ON d.organization_id = org.id
                WHERE (
                    (d.trd_series_id = ANY($1::int[]) OR d.trd_subseries_id = ANY($2::int[]))
                    OR d.expediente_id IN (SELECT expediente_id FROM expediente_assignments WHERE user_id = $3)
                    OR d.user_id = $3
                )
                ${userExtraAnd}
                GROUP BY d.id, e.id, sub.id, ser.id, org.id
                ORDER BY d.created_at DESC
                ${limitClause}
            `;
            db.all(filteredQuery, [paramSeriesIds, paramSubseriesIds, req.user.id], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error al obtener documentos.' });
                res.json({ data: rows });
            });
        });
        return;
    }

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener documentos.' });
        res.json({ data: rows });
    });
});

// GET /expediente/:id - List documents belonging to a specific expediente
router.get('/expediente/:id', (req, res) => {
    const query = `
        SELECT d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.created_at, d.origen, d.metadata_values,
               d.expediente_id, d.shared_group_id, d.source_document_id, d.page_count, d.user_id,
               CASE WHEN d.shared_group_id IS NOT NULL THEN (SELECT COUNT(*)::int FROM documents ds WHERE ds.shared_group_id = d.shared_group_id) ELSE 1 END AS shared_count,
               e.title as expediente_title, e.expediente_code, e.subserie
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        WHERE d.expediente_id = ?
        ORDER BY d.filename ASC
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Helper function to auto-rename docs in an expediente based on TRD
const fixExpedienteNames = async (searchValue) => {
    try {
        const sqliteQuery = `
            SELECT e.*, 
                   sub.id as subseries_id, ser.id as series_id
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
            WHERE e.id = ? OR e.title LIKE ? OR e.expediente_code LIKE ?
            LIMIT 1
        `;
        const likeParam = `%${searchValue}%`;
        
        const getExpediente = () => new Promise((resolve, reject) => {
            const idVal = isNaN(parseInt(searchValue)) ? 0 : parseInt(searchValue);
            db.get(sqliteQuery, [idVal, likeParam, likeParam], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        
        const expediente = await getExpediente();
        if (!expediente) return { success: false, error: 'Expediente no encontrado.' };

        const getTypologyOrderMap = () => new Promise((resolve) => {
            let q, params;
            if (expediente.subseries_id) {
                q = "SELECT typology_name FROM trd_typologies WHERE subseries_id = ? ORDER BY id ASC";
                params = [expediente.subseries_id];
            } else if (expediente.series_id) {
                q = "SELECT typology_name FROM trd_typologies WHERE series_id = ? ORDER BY id ASC";
                params = [expediente.series_id];
            } else {
                return resolve({});
            }
            db.all(q, params, (err, rows) => {
                const map = {};
                if (!err && rows) {
                    rows.forEach((r, idx) => {
                        const normalized = r.typology_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                        map[normalized] = idx + 1;
                    });
                }
                resolve(map);
            });
        });
        const typologyOrderMap = await getTypologyOrderMap();

        const getDocs = () => new Promise((resolve) => {
            db.all("SELECT id, filename, path, typology_name FROM documents WHERE expediente_id = ? ORDER BY id ASC", [expediente.id], (err, rows) => {
                resolve(rows || []);
            });
        });
        const docs = await getDocs();
        
        const resultsLog = [];
        const typologyCounts = {};

        for (const doc of docs) {
            const typName = doc.typology_name || 'Documento_General';
            typologyCounts[typName] = (typologyCounts[typName] || 0) + 1;
            const currentDocIndex = typologyCounts[typName];

            const safeName = typName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
            const normalizedTypName = typName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            const trdOrder = typologyOrderMap[normalizedTypName] || 99;
            const paddedOrder = String(trdOrder).padStart(2, '0');
            
            let newFilename = currentDocIndex > 1 ? `${paddedOrder}_${safeName}_${currentDocIndex}.pdf` : `${paddedOrder}_${safeName}.pdf`;

            if (doc.filename === newFilename) {
                resultsLog.push(`Doc ${doc.id}: OK (${newFilename})`);
                continue;
            }

            const oldPath = doc.path;
            const dir = path.dirname(oldPath);
            const newPath = path.join(dir, newFilename);

            try {
                if (!fs.existsSync(oldPath)) { resultsLog.push(`Doc ${doc.id}: Archivo físico no existe en oldPath, se conserva nombre en BD`); continue; }
                fs.renameSync(oldPath, newPath);
            } catch (err) {
                resultsLog.push(`Doc ${doc.id}: Error físico -> ${err.message}`);
                continue;
            }

            // Actualizar Backup también si existe
            const getSystemSetting = (key) => new Promise((resolve) => {
                db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => {
                    if (err || !row) resolve(null);
                    else resolve(row.value);
                });
            });
            const backupBasePath = await getSystemSetting('backup_path');
            if (backupBasePath && backupBasePath.trim() !== '') {
                const basePath = await getSystemSetting('storage_path');
                // Intentar deducir la ruta relativa del backup comparando con storage_path
                let relativePath = '';
                if (oldPath.startsWith(basePath)) {
                    relativePath = oldPath.substring(basePath.length);
                } else if (oldPath.includes('uploads/Gestion_Documental')) {
                    relativePath = oldPath.split('uploads/Gestion_Documental')[1];
                }

                if (relativePath) {
                    const oldBackupPath = path.join(backupBasePath, relativePath);
                    const newBackupPath = path.join(path.dirname(oldBackupPath), newFilename);
                    try {
                        if (fs.existsSync(oldBackupPath)) fs.renameSync(oldBackupPath, newBackupPath);
                    } catch(e) { console.error("[BACKUP] Error renombrando:", e); }
                }
            }

            await new Promise((resolve) => {
                db.run("UPDATE documents SET filename = ?, path = ? WHERE id = ?", [newFilename, newPath, doc.id], (err) => {
                    if (err) resultsLog.push(`Doc ${doc.id}: Error BD -> ${err.message}`);
                    else resultsLog.push(`Doc ${doc.id}: Renombrado a ${newFilename}`);
                    resolve();
                });
            });
        }
        return { success: true, logs: resultsLog };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

// GET /fix-names/:expedienteId - Run the rename script for a specific expediente via API
router.get('/fix-names/:expedienteId', async (req, res) => {
    const result = await fixExpedienteNames(req.params.expedienteId);
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ success: true, message: 'Renombrado completado.', logs: result.logs });
});

// Helper: verify if a non-admin user can edit/delete a document or upload to an expediente
const userCanManageDocOrExp = async (user, doc, targetExpedienteId = null) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    const uid = Number(user.id);
    if (doc && Number(doc.user_id) === uid) return true;

    const expIdToCheck = targetExpedienteId || (doc && doc.expediente_id);
    if (expIdToCheck) {
        const assigned = await new Promise((resolve) => {
            db.get(
                `SELECT 1 AS ok FROM expediente_assignments WHERE expediente_id = $1 AND user_id = $2 LIMIT 1`,
                [expIdToCheck, uid],
                (err, row) => resolve(!err && !!row)
            );
        });
        if (assigned) return true;
    }

    // Check TRD permissions on the document or target expediente
    const trdRow = await new Promise((resolve) => {
        if (expIdToCheck) {
            db.get(
                `SELECT ser.id AS series_id, sub.id AS subseries_id
                 FROM expedientes e
                 LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                 LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
                 WHERE e.id = ? LIMIT 1`,
                [expIdToCheck],
                (err, row) => resolve(err ? null : row)
            );
        } else if (doc) {
            resolve({ series_id: doc.trd_series_id || null, subseries_id: doc.trd_subseries_id || null });
        } else {
            resolve(null);
        }
    });

    if (!trdRow) return false;
    return new Promise((resolve) => {
        db.get(
            `SELECT can_upload, can_view FROM user_trd_permissions
             WHERE user_id = $1 AND (series_id = $2 OR subseries_id = $3)
             ORDER BY can_upload DESC, can_view DESC LIMIT 1`,
            [uid, trdRow.series_id || -1, trdRow.subseries_id || -1],
            (err, perm) => resolve(!err && perm && (perm.can_upload === 1 || perm.can_view === 1))
        );
    });
};

// Helper: resolve storage folder for a target expediente + typology
const resolveTargetDirsForExpediente = async (expedienteId, typologyName) => {
    const expRow = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM expedientes WHERE id = ? LIMIT 1`, [expedienteId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
    if (!expRow) throw new Error('Expediente destino no encontrado.');

    const trdInfo = await new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
                ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                org.section_code, org.subsection_code, org.regional_code, org.center_code,
                org.storage_path, ser.id as series_id, sub.id as id, org.id as dependency_id
             FROM expedientes e
             LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
             LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
             LEFT JOIN organization_structure org ON ser.dependency_id = org.id
             WHERE e.id = ? LIMIT 1`,
            [expedienteId],
            (err, row) => (err ? reject(err) : resolve(row))
        );
    });

    const getSystemSetting = (key) => new Promise((resolve) => {
        db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => resolve(err || !row ? null : row.value));
    });

    const globalHierarchy = await getSystemSetting('folder_hierarchy');
    let hierarchy = [];
    try {
        const raw = trdInfo?.sub_hierarchy || trdInfo?.ser_hierarchy || globalHierarchy;
        hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
    } catch (e) {
        hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
    }

    let metaValues = {};
    try {
        metaValues = typeof expRow.metadata_values === 'string'
            ? JSON.parse(expRow.metadata_values || '{}')
            : (expRow.metadata_values || {});
    } catch (e) { metaValues = {}; }

    const getCleanSuffix = (fullCode, separator) => {
        if (!fullCode) return '';
        const parts = String(fullCode).split(separator);
        return parts[parts.length - 1].replace(/[.-]/g, '');
    };

    const regCode = trdInfo?.regional_code || '68';
    const ctrCode = trdInfo?.center_code || '9224';
    const serieSuffix = getCleanSuffix(trdInfo?.series_code, '-');
    const subserieSuffix = getCleanSuffix(trdInfo?.subseries_code, '.');

    const basePath = process.env.LOCAL_STORAGE_PATH || (await getSystemSetting('storage_path')) || trdInfo?.storage_path || path.join(__dirname, '../uploads/Gestion_Documental');
    const backupBasePath = await getSystemSetting('backup_path');

    const typValue = await new Promise((resolve) => {
        db.get("SELECT document_type_value FROM trd_typologies WHERE typology_name = ?", [typologyName], (err, row) => {
            resolve(row?.document_type_value || null);
        });
    });

    const rawLevels = hierarchy.map(level => {
        let value = '';
        const type = level.type;
        if (type === 'reg') value = regCode;
        else if (type === 'ctr') value = ctrCode;
        else if (type === 'dep') value = trdInfo?.section_code || trdInfo?.subsection_code || 'DEP';
        else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
        else if (type === 'ser') value = trdInfo?.series_code || 'SERIE';
        else if (type === 'ser_name') value = trdInfo?.series_name || 'SERIE';
        else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
        else if (type === 'sub') value = trdInfo?.subseries_code || 'SUBSERIE';
        else if (type === 'sub_name') value = trdInfo?.subseries_name || 'SUBSERIE';
        else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
        else if (type === 'typ_val') value = String(typValue || '');
        else if (type === 'meta_1') {
            const raw = expRow.title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
            value = (raw.trim() === 'Sin Título') ? '' : raw;
        } else if (type.startsWith('meta_')) {
            const idx = type.split('_')[1];
            value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '';
        }
        return String(value || '').replace(/[.-]/g, '').replace(/[<>:"/\\|?*]/g, '').trim();
    });

    const pathParts = rawLevels.filter(v => v.trim() !== '');
    const expDir = path.join(basePath, ...pathParts);
    if (!fs.existsSync(expDir)) fs.mkdirSync(expDir, { recursive: true });

    let backupExpDir = null;
    if (backupBasePath && backupBasePath.trim() !== '') {
        backupExpDir = path.join(backupBasePath, ...pathParts);
        if (!fs.existsSync(backupExpDir)) {
            try { fs.mkdirSync(backupExpDir, { recursive: true }); }
            catch (e) { backupExpDir = null; }
        }
    }

    return { expRow, trdInfo, expDir, backupExpDir, basePath, backupBasePath };
};

// PUT /:id - Update document details, optionally replace uploaded file or move to another expediente
router.put('/:id', requireAuth, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const {
        filename,
        typology_name,
        document_date,
        origen,
        path: newDirectPath,
        metadata_values,
        expediente_id: newExpIdRaw,
        custom_filename_override,
        reset_status,
        sync_shared
    } = req.body || {};

    const cleanupTempUpload = () => {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
    };

    try {
        const doc = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM documents WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!doc) {
            cleanupTempUpload();
            return res.status(404).json({ error: 'Documento no encontrado' });
        }

        const canEditCurrent = await userCanManageDocOrExp(req.user, doc, null);
        if (!canEditCurrent) {
            cleanupTempUpload();
            return res.status(403).json({ error: 'No tiene permisos para editar este documento.' });
        }

        const targetExpId = newExpIdRaw ? Number(newExpIdRaw) : Number(doc.expediente_id || 0);
        const isMovingExpediente = Boolean(targetExpId && doc.expediente_id && targetExpId !== Number(doc.expediente_id));

        if (isMovingExpediente) {
            const canUploadTarget = await userCanManageDocOrExp(req.user, doc, targetExpId);
            if (!canUploadTarget) {
                cleanupTempUpload();
                return res.status(403).json({ error: 'No tiene permisos sobre el expediente de destino.' });
            }
        }

        const finalTypology = (typology_name && String(typology_name).trim()) ? String(typology_name).trim() : doc.typology_name;
        const oldPath = doc.path;
        let resolvedFilename = doc.filename;
        let resolvedPath = newDirectPath || oldPath;
        let updatedOrgId = doc.organization_id;
        let updatedSeriesId = doc.trd_series_id;
        let updatedSubseriesId = doc.trd_subseries_id;
        let targetDirs = null;

        if (isMovingExpediente || (req.file && targetExpId)) {
            targetDirs = await resolveTargetDirsForExpediente(targetExpId, finalTypology);
            if (isMovingExpediente && targetDirs.trdInfo) {
                updatedOrgId = targetDirs.trdInfo.dependency_id || updatedOrgId;
                updatedSeriesId = targetDirs.trdInfo.series_id || updatedSeriesId;
                updatedSubseriesId = targetDirs.trdInfo.id || updatedSubseriesId;
            }
        }

        // 1. If a replacement file was uploaded, convert image->PDF if needed and validate PDF
        let replacementPdfBytes = null;
        let replacementPageCount = null;
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase().trim();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
            let rawBytes = fs.readFileSync(req.file.path);

            if (imageExtensions.includes(ext)) {
                const pdfDocTemp = await PDFDocument.create();
                if (ext === '.tif' || ext === '.tiff') {
                    const metadata = await sharp(req.file.path).metadata();
                    const pages = metadata.pages || 1;
                    for (let i = 0; i < pages; i++) {
                        const pageBuffer = await sharp(req.file.path, { page: i }).jpeg().toBuffer();
                        const image = await pdfDocTemp.embedJpg(pageBuffer);
                        const pdfPage = pdfDocTemp.addPage([image.width, image.height]);
                        pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                    }
                } else {
                    const image = ext === '.png' ? await pdfDocTemp.embedPng(rawBytes) : await pdfDocTemp.embedJpg(rawBytes);
                    const page = pdfDocTemp.addPage([image.width, image.height]);
                    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                }
                rawBytes = await pdfDocTemp.save();
            }

            const validatedPdf = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
            replacementPageCount = validatedPdf.getPageCount();
            replacementPdfBytes = await validatedPdf.save();
            cleanupTempUpload();
        }

        // 2. Move / write physical file on disk
        if (isMovingExpediente && targetDirs) {
            const tempTargetName = `${Date.now()}_${doc.filename}`;
            const movedPath = path.join(targetDirs.expDir, tempTargetName);
            if (replacementPdfBytes) {
                fs.writeFileSync(movedPath, replacementPdfBytes);
                if (oldPath && fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (_) {}
                }
            } else if (oldPath && fs.existsSync(oldPath)) {
                fs.copyFileSync(oldPath, movedPath);
                try { fs.unlinkSync(oldPath); } catch (_) {}
            }
            if (targetDirs.backupExpDir && fs.existsSync(movedPath)) {
                try { fs.copyFileSync(movedPath, path.join(targetDirs.backupExpDir, tempTargetName)); } catch (_) {}
            }
            resolvedFilename = tempTargetName;
            resolvedPath = movedPath;
        } else if (replacementPdfBytes) {
            const destDir = oldPath ? path.dirname(oldPath) : (targetDirs ? targetDirs.expDir : path.join(__dirname, '../uploads/Gestion_Documental'));
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            const destPath = oldPath || path.join(destDir, resolvedFilename);
            // Unlink first so hardlinked siblings are not overwritten unless sync_shared is enabled
            if (fs.existsSync(destPath)) {
                try { fs.unlinkSync(destPath); } catch (_) {}
            }
            fs.writeFileSync(destPath, replacementPdfBytes);
            resolvedPath = destPath;
            if (targetDirs && targetDirs.backupExpDir) {
                try { fs.writeFileSync(path.join(targetDirs.backupExpDir, path.basename(destPath)), replacementPdfBytes); } catch (_) {}
            }
        }

        const finalMeta = metadata_values !== undefined
            ? (typeof metadata_values === 'string' ? metadata_values : JSON.stringify(metadata_values))
            : doc.metadata_values;
        const shouldResetStatus = reset_status === 'true' || reset_status === true || (Boolean(replacementPdfBytes) && doc.status === 'Cargado' && reset_status !== 'false');
        const finalStatus = shouldResetStatus ? 'Pendiente' : doc.status;

        await new Promise((resolve, reject) => {
            const updateQ = `
                UPDATE documents
                SET filename = ?, path = ?, typology_name = ?, document_date = ?, origen = ?,
                    metadata_values = ?, expediente_id = ?, organization_id = ?,
                    trd_series_id = ?, trd_subseries_id = ?, status = ?,
                    page_count = COALESCE(?::int, page_count)
                WHERE id = ?
            `;
            db.run(
                updateQ,
                [
                    resolvedFilename,
                    resolvedPath,
                    finalTypology,
                    document_date || doc.document_date,
                    origen || doc.origen,
                    finalMeta,
                    targetExpId || doc.expediente_id,
                    updatedOrgId,
                    updatedSeriesId,
                    updatedSubseriesId,
                    finalStatus,
                    replacementPageCount,
                    id
                ],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 3. Re-sequence TRD filenames on old and/or target expediente
        if (isMovingExpediente && doc.expediente_id) {
            await fixExpedienteNames(doc.expediente_id);
        }
        if (targetExpId) {
            await fixExpedienteNames(targetExpId);
        }

        // 4. If user explicitly provided a custom filename override, apply it after auto-sequencing
        const cleanRequestedName = filename
            ? String(filename).replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*]/g, '').trim()
            : '';
        const oldNameNoExt = String(doc.filename || '').replace(/\.pdf$/i, '').trim();
        const isCustomOverride = custom_filename_override === 'true' || custom_filename_override === true ||
            (cleanRequestedName && cleanRequestedName !== oldNameNoExt && typology_name === doc.typology_name);

        if (isCustomOverride && cleanRequestedName && cleanRequestedName.length < 120) {
            const refreshedDoc = await new Promise((resolve) => {
                db.get("SELECT filename, path FROM documents WHERE id = ?", [id], (e, r) => resolve(r || null));
            });
            if (refreshedDoc && refreshedDoc.path) {
                const desiredFilename = `${cleanRequestedName}.pdf`;
                if (refreshedDoc.filename !== desiredFilename) {
                    const desiredPath = path.join(path.dirname(refreshedDoc.path), desiredFilename);
                    try {
                        if (fs.existsSync(refreshedDoc.path) && refreshedDoc.path !== desiredPath) {
                            fs.renameSync(refreshedDoc.path, desiredPath);
                        }
                        await new Promise((resolve) => {
                            db.run("UPDATE documents SET filename = ?, path = ? WHERE id = ?", [desiredFilename, desiredPath, id], () => resolve());
                        });
                    } catch (renameErr) {
                        console.warn('[PUT /:id] No se pudo aplicar nombre personalizado:', renameErr.message);
                    }
                }
            }
        }

        // 5. Propagate synchronized edits across shared_group_id siblings if requested
        const shouldSyncShared = !isMovingExpediente && doc.shared_group_id && (sync_shared === 'true' || sync_shared === true);
        let syncedSiblings = 0;
        if (shouldSyncShared) {
            const currentPrimary = await new Promise((resolve) => {
                db.get("SELECT path FROM documents WHERE id = ?", [id], (e, r) => resolve(r || null));
            });
            const siblings = await new Promise((resolve) => {
                db.all("SELECT * FROM documents WHERE shared_group_id = ? AND id != ?", [doc.shared_group_id, id], (e, rows) => resolve(rows || []));
            });
            for (const sib of siblings) {
                try {
                    if (replacementPdfBytes && sib.path && currentPrimary?.path && fs.existsSync(currentPrimary.path)) {
                        linkOrCopyFileSync(currentPrimary.path, sib.path);
                    }
                    const sibStatus = (replacementPdfBytes && sib.status === 'Cargado' && reset_status !== 'false') ? 'Pendiente' : sib.status;
                    await new Promise((resolve) => {
                        db.run(
                            `UPDATE documents SET typology_name = ?, document_date = ?, origen = ?, metadata_values = ?, status = ?, page_count = COALESCE(?::int, page_count) WHERE id = ?`,
                            [
                                finalTypology,
                                document_date || sib.document_date,
                                origen || sib.origen,
                                finalMeta,
                                sibStatus,
                                replacementPageCount,
                                sib.id
                            ],
                            () => resolve()
                        );
                    });
                    if (sib.expediente_id && finalTypology !== sib.typology_name) {
                        await fixExpedienteNames(sib.expediente_id);
                    }
                    syncedSiblings++;
                } catch (sibErr) {
                    console.warn(`[PUT /:id sync_shared] Error actualizando hermano ${sib.id}:`, sibErr.message);
                }
            }
        }

        const updatedDoc = await new Promise((resolve) => {
            db.get("SELECT id, filename, path, typology_name, document_date, origen, status, expediente_id, shared_group_id, source_document_id FROM documents WHERE id = ?", [id], (e, r) => resolve(r || null));
        });

        res.json({
            success: true,
            message: 'Documento actualizado correctamente',
            synced_siblings: syncedSiblings,
            path: updatedDoc?.path || resolvedPath,
            filename: updatedDoc?.filename || resolvedFilename,
            document: updatedDoc
        });
    } catch (err) {
        cleanupTempUpload();
        console.error('[PUT /:id] Error actualizando documento:', err);
        res.status(500).json({ error: err.message || 'Error al actualizar el documento.' });
    }
});

// DELETE /:id - Remove document from DB and delete physical file
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    db.get("SELECT * FROM documents WHERE id = ?", [id], async (err, doc) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

        const canDelete = await userCanManageDocOrExp(req.user, doc, null);
        if (!canDelete) {
            return res.status(403).json({ error: 'No tiene permisos para eliminar este documento.' });
        }

        const filePath = doc.path;

        // 1. Delete physical file
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[DELETE] Archivo eliminado: ${filePath}`);
            } else {
                console.warn(`[DELETE] El archivo no existía físicamente: ${filePath}`);
            }
        } catch (fsErr) {
            console.error("[DELETE] Error eliminando archivo físico:", fsErr);
        }

        // 2. Delete from DB
        db.run("DELETE FROM documents WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Documento eliminado correctamente' });
        });
    });
});

// GET /stats/summary - Summary for Dashboard (legado, mantener compatibilidad)
router.get('/stats/summary', (req, res) => {
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM documents WHERE status = 'Pendiente') as pending,
            (SELECT COUNT(*) FROM documents WHERE status = 'Cargado' AND CAST(load_date AS DATE) = CURRENT_DATE) as completed
    `;
    
    db.get(query, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: row || { pending: 0, completed: 0 } });
    });
});

// GET /stats/dashboard - Estadísticas completas para el Dashboard
router.get('/stats/dashboard', requireAuth, (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const isSuperOrAdmin = user.role === 'admin' || user.role === 'superadmin';

    // Función auxiliar para obtener las estadísticas de expedientes asignados a un usuario
    const getAssignedStats = (userId) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    COUNT(DISTINCT e.id) AS total_expedientes,
                    COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN e.id END) AS expedientes_con_docs,
                    COUNT(DISTINCT CASE WHEN d.id IS NULL THEN e.id END) AS expedientes_sin_docs,
                    COUNT(CASE WHEN d.status = 'Pendiente' THEN 1 END) AS docs_pendientes,
                    COUNT(CASE WHEN (d.user_id = ? OR ea.user_id = ?) AND DATE(d.created_at) = CURRENT_DATE THEN 1 END) AS docs_cargados_hoy,
                    COUNT(CASE WHEN d.user_id = ? THEN 1 WHEN d.user_id IS NULL AND d.id IS NOT NULL THEN 1 END) AS docs_cargados_total,
                    COUNT(d.id) AS total_docs
                FROM expediente_assignments ea
                JOIN expedientes e ON e.id = ea.expediente_id
                LEFT JOIN documents d ON d.expediente_id = e.id
                WHERE ea.user_id = ?
            `;
            db.get(query, [userId, userId, userId, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {
                    total_expedientes: 0, expedientes_con_docs: 0,
                    expedientes_sin_docs: 0, docs_pendientes: 0,
                    docs_cargados_hoy: 0, docs_cargados_total: 0, total_docs: 0
                });
            });
        });
    };

    if (isSuperOrAdmin) {
        // Para admin/superadmin: stats globales de TODOS los expedientes
        const globalQuery = `
            SELECT
                (SELECT COUNT(*) FROM expedientes) AS total_expedientes,
                (SELECT COUNT(DISTINCT e.id) 
                 FROM expedientes e 
                 INNER JOIN documents d ON d.expediente_id = e.id
                ) AS expedientes_con_docs,
                (SELECT COUNT(DISTINCT e.id) 
                 FROM expedientes e 
                 LEFT JOIN documents d ON d.expediente_id = e.id
                 WHERE d.id IS NULL
                ) AS expedientes_sin_docs,
                (SELECT COUNT(*) FROM documents WHERE status = 'Pendiente') AS docs_pendientes,
                (SELECT COUNT(*) FROM documents WHERE DATE(created_at) = CURRENT_DATE) AS docs_cargados_hoy,
                (SELECT COUNT(*) FROM documents WHERE status = 'Cargado') AS docs_cargados_total,
                (SELECT COUNT(*) FROM documents) AS total_docs
        `;
        db.get(globalQuery, [], async (err, globalRow) => {
            if (err) return res.status(500).json({ error: err.message });
            try {
                const assignedRow = await getAssignedStats(user.id);
                res.json({
                    data: globalRow || {},
                    assigned: assignedRow,
                    scope: 'global'
                });
            } catch (assignedErr) {
                res.status(500).json({ error: assignedErr.message });
            }
        });
    } else {
        // Para usuarios normales: stats de expedientes asignados
        getAssignedStats(user.id)
            .then(assignedRow => {
                res.json({
                    data: assignedRow,
                    scope: 'assigned'
                });
            })
            .catch(err => {
                res.status(500).json({ error: err.message });
            });
    }
});



// ── GET /file/:id — Servir PDF con fallback automático ────────────────────────
// 1. Intenta servir desde el path registrado en BD (disco/OneDrive)
// 2. Si no existe, busca por nombre de archivo en uploads/ (backup local)
// 3. Si tampoco existe → 404
router.get('/file/:id', async (req, res) => {
    const { id } = req.params;

    db.get('SELECT path, filename FROM documents WHERE id = ?', [id], async (err, doc) => {
        if (err) return res.status(500).json({ error: 'Error al consultar la base de datos.' });
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

        let primaryPath = doc.path;
        const filename = doc.filename;

        // Si tenemos local storage path, intentar mapear el path de la BD a local
        if (primaryPath && process.env.LOCAL_STORAGE_PATH) {
            try {
                const dbStoragePath = await new Promise((resolve) => {
                    db.get("SELECT value FROM system_settings WHERE key = 'storage_path'", [], (err, row) => {
                        resolve(row?.value || null);
                    });
                });
                if (dbStoragePath) {
                    const normDbPath = primaryPath.replace(/\\/g, '/');
                    const normDbStorage = dbStoragePath.replace(/\\/g, '/');
                    if (normDbPath.startsWith(normDbStorage)) {
                        const relative = normDbPath.substring(normDbStorage.length);
                        const resolved = path.join(process.env.LOCAL_STORAGE_PATH, relative);
                        if (fs.existsSync(resolved)) {
                            primaryPath = resolved;
                        }
                    }
                }
            } catch (e) {
                console.warn('[file/:id] Error al mapear path local:', e.message);
            }
        }

        // Helper para servir el archivo
        const serveFile = (filePath, source) => {
            console.log(`[file/:id] ✅ Sirviendo desde ${source}: ${filePath}`);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.sendFile(filePath, { root: '/' }, (sendErr) => {
                if (sendErr && !res.headersSent) {
                    console.error('[file/:id] Error al enviar archivo:', sendErr.message);
                    res.status(500).json({ error: 'Error al enviar el archivo.' });
                }
            });
        };

        // 1. Intentar ruta principal
        if (primaryPath && fs.existsSync(primaryPath)) {
            return serveFile(primaryPath, 'ruta principal');
        }

        // 2. Fallback: buscar en uploads/ por nombre de archivo (recursivo)
        console.warn(`[file/:id] ⚠️ No encontrado en ruta principal: ${primaryPath}. Buscando en backup...`);
        const uploadsDir = path.join(__dirname, '..', 'uploads');

        const findInDir = (dir) => {
            if (!fs.existsSync(dir)) return null;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        const found = findInDir(fullPath);
                        if (found) return found;
                    } else if (entry.isFile() && entry.name === filename) {
                        return fullPath;
                    }
                }
            } catch (e) {
                console.warn('[file/:id] No se pudo leer directorio:', dir);
            }
            return null;
        };

        const backupPath = findInDir(uploadsDir);

        if (backupPath) {
            console.log(`[file/:id] ✅ Encontrado en backup: ${backupPath}`);
            return serveFile(backupPath, 'backup local');
        }

        // 3. No encontrado en ninguna parte
        console.error(`[file/:id] ❌ Archivo no disponible: ${filename}`);
        return res.status(404).json({
            error: 'El archivo PDF no está disponible. El disco de almacenamiento puede no estar conectado y no hay copia de respaldo local.',
            filename,
            primaryPath
        });
    });
});

// POST /merge-upload - Merge multiple files into one PDF and save
router.post('/merge-upload', requireAuth, upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: 'Se requieren al menos 2 archivos para unir.' });
    }

    const { typology_name, origen = 'DIGITALIZADO', description = '' } = req.body;
    if (!typology_name) {
        return res.status(400).json({ error: 'La tipología es requerida para el documento resultante.' });
    }

    try {
        const expediente = JSON.parse(req.body.expediente || '{}');
        if (!expediente || !expediente.id) {
            return res.status(400).json({ error: 'El expediente de destino es requerido.' });
        }

        // 1. LOOKUP TRD CODES AND STORAGE PATH
        const trdInfo = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as sub_hierarchy,
                    ser.series_code, ser.series_name, ser.folder_hierarchy as ser_hierarchy,
                    org.section_code, org.subsection_code, org.regional_code, org.center_code,
                    org.storage_path, org.entity_name, org.regional_name, org.center_name,
                    ser.id as series_id, sub.id as id, org.id as dependency_id
                FROM expedientes e
                LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
                LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
                LEFT JOIN organization_structure org ON ser.dependency_id = org.id
                WHERE e.id = ?
                LIMIT 1
            `;
            db.get(query, [expediente.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 2. CHECK PERMISSIONS
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            const hasPerm = await new Promise((resolve) => {
                const checkTrd = () => {
                    const q = `
                        SELECT can_upload FROM user_trd_permissions 
                        WHERE user_id = $1 AND (series_id = $2 OR subseries_id = $3)
                        ORDER BY can_upload DESC LIMIT 1
                    `;
                    db.get(q, [req.user.id, trdInfo?.series_id || null, trdInfo?.id || null], (err, row) => {
                        resolve(row ? row.can_upload === 1 : false);
                    });
                };

                if (expediente && expediente.id) {
                    db.get(
                        `SELECT 1 AS ok_assign FROM expediente_assignments WHERE expediente_id = $1 AND user_id = $2 LIMIT 1`,
                        [expediente.id, req.user.id],
                        (assignErr, assignRow) => {
                            if (!assignErr && assignRow) return resolve(true);
                            checkTrd();
                        }
                    );
                } else {
                    checkTrd();
                }
            });
            if (!hasPerm) {
                return res.status(403).json({ error: 'No tiene permisos para cargar documentos en esta Serie/Subserie.' });
            }
        }

        // 3. BUILD PATH
        const getSystemSetting = (key) => new Promise((resolve) => {
            db.get("SELECT value FROM system_settings WHERE key = ?", [key], (err, row) => {
                if (err || !row) resolve(null);
                else resolve(row.value);
            });
        });

        const globalHierarchy = await getSystemSetting('folder_hierarchy');
        let hierarchy = [];
        try {
            const raw = trdInfo?.sub_hierarchy || trdInfo?.ser_hierarchy || globalHierarchy;
            hierarchy = raw ? JSON.parse(raw) : [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }];
        } catch (e) { hierarchy = [{ type: 'dep' }, { type: 'ser' }, { type: 'meta_1' }]; }

        let metaValues = {};
        try {
            metaValues = typeof expediente.metadata_values === 'string'
                ? JSON.parse(expediente.metadata_values || '{}')
                : (expediente.metadata_values || {});
        } catch (e) { metaValues = {}; }

        const getCleanSuffix = (fullCode, separator) => {
            if (!fullCode) return '';
            const parts = String(fullCode).split(separator);
            return parts[parts.length - 1].replace(/[.-]/g, '');
        };

        const regCode = trdInfo?.regional_code || '68';
        const ctrCode = trdInfo?.center_code || '9224';
        const serieSuffix = getCleanSuffix(trdInfo?.series_code, '-');
        const subserieSuffix = getCleanSuffix(trdInfo?.subseries_code, '.');

        const basePath = process.env.LOCAL_STORAGE_PATH || (await getSystemSetting('storage_path')) || trdInfo?.storage_path || path.join(__dirname, '../uploads/Gestion_Documental');
        const backupBasePath = await getSystemSetting('backup_path');

        const getTypologyMapping = (name) => new Promise((resolve) => {
            db.get("SELECT document_type_value FROM trd_typologies WHERE typology_name = ?", [name], (err, row) => {
                resolve(row?.document_type_value || null);
            });
        });
        const typValue = await getTypologyMapping(typology_name);

        const rawLevels = hierarchy.map(level => {
            let value = '';
            const type = level.type;

            if (type === 'reg') value = regCode;
            else if (type === 'ctr') value = ctrCode;
            else if (type === 'dep') value = trdInfo?.section_code || trdInfo?.subsection_code || 'DEP';
            else if (type === 'dep_conc') value = `${regCode}${ctrCode}`;
            else if (type === 'ser') value = trdInfo?.series_code || 'SERIE';
            else if (type === 'ser_name') value = trdInfo?.series_name || 'SERIE';
            else if (type === 'ser_conc') value = `${regCode}${ctrCode}${serieSuffix}`;
            else if (type === 'sub') value = trdInfo?.subseries_code || 'SUBSERIE';
            else if (type === 'sub_name') value = trdInfo?.subseries_name || 'SUBSERIE';
            else if (type === 'sub_conc') value = `${regCode}${ctrCode}${serieSuffix}${subserieSuffix}`;
            else if (type === 'typ_val') value = String(typValue || '');
            else if (type === 'meta_1') {
                const raw = expediente.title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
                value = (raw.trim() === 'Sin Título') ? '' : raw;
            }
            else if (type.startsWith('meta_')) {
                const idx = type.split('_')[1];
                value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '';
            }
            
            return String(value || '')
                .replace(/[.-]/g, '')
                .replace(/[<>:"/\\|?*]/g, '') 
                .trim();
        });

        const meta1Index = hierarchy.findIndex(h => h.type === 'meta_1');
        if (meta1Index !== -1 && (!rawLevels[meta1Index] || rawLevels[meta1Index].trim() === '')) {
            throw new Error(
                `El expediente "${expediente.title || '(sin título)'}" no tiene título válido.`
            );
        }

        const pathParts = rawLevels.filter(v => v.trim() !== '');
        const expDir = path.join(basePath, ...pathParts);

        if (!fs.existsSync(expDir)) {
            fs.mkdirSync(expDir, { recursive: true });
        }

        let backupExpDir = null;
        if (backupBasePath && backupBasePath.trim() !== '') {
            backupExpDir = path.join(backupBasePath, ...pathParts);
            if (!fs.existsSync(backupExpDir)) {
                try { fs.mkdirSync(backupExpDir, { recursive: true }); } 
                catch (e) { console.error("[BACKUP] Error creating dir:", e); backupExpDir = null; }
            }
        }

        // 4. MERGE FILES INTO A SINGLE PDF
        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            const fileBytes = fs.readFileSync(file.path);
            let pagePdfDoc;

            const ext = path.extname(file.originalname).toLowerCase().trim();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];

            if (imageExtensions.includes(ext)) {
                const pdfDocTemp = await PDFDocument.create();
                if (ext === '.tif' || ext === '.tiff') {
                    const metadata = await sharp(file.path).metadata();
                    const pages = metadata.pages || 1;
                    for (let i = 0; i < pages; i++) {
                        const pageBuffer = await sharp(file.path, { page: i }).jpeg().toBuffer();
                        const image = await pdfDocTemp.embedJpg(pageBuffer);
                        const pdfPage = pdfDocTemp.addPage([image.width, image.height]);
                        pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                    }
                } else {
                    const image = ext === '.png' ? await pdfDocTemp.embedPng(fileBytes) : await pdfDocTemp.embedJpg(fileBytes);
                    const page = pdfDocTemp.addPage([image.width, image.height]);
                    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                }
                const tempPdfBytes = await pdfDocTemp.save();
                pagePdfDoc = await PDFDocument.load(tempPdfBytes, { ignoreEncryption: true });
            } else {
                pagePdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
            }

            const copiedPages = await mergedPdf.copyPages(pagePdfDoc, pagePdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        // 5. GENERATE FILENAME
        const getTypologyOrderMap = async (seriesId, subseriesId) => {
            return new Promise((resolve) => {
                let q, params;
                if (subseriesId) {
                    q = "SELECT typology_name FROM trd_typologies WHERE subseries_id = ? ORDER BY id ASC";
                    params = [subseriesId];
                } else if (seriesId) {
                    q = "SELECT typology_name FROM trd_typologies WHERE series_id = ? ORDER BY id ASC";
                    params = [seriesId];
                } else {
                    return resolve({});
                }
                db.all(q, params, (err, rows) => {
                    const map = {};
                    if (!err && rows) {
                        rows.forEach((r, idx) => {
                            const normalized = r.typology_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                            map[normalized] = idx + 1;
                        });
                    }
                    resolve(map);
                });
            });
        };

        const typologyOrderMap = await getTypologyOrderMap(trdInfo?.series_id, trdInfo?.id);

        const getTypologyCountMap = () => {
            return new Promise((resolve) => {
                const countQ = "SELECT typology_name, COUNT(id) as total FROM documents WHERE expediente_id = ? GROUP BY typology_name";
                db.all(countQ, [expediente.id], (err, rows) => {
                    const map = {};
                    if (!err && rows) {
                        rows.forEach(r => map[r.typology_name] = r.total);
                    }
                    resolve(map);
                });
            });
        };
        const typologyCounts = await getTypologyCountMap();
        typologyCounts[typology_name] = (typologyCounts[typology_name] || 0) + 1;

        const generateFilename = (typName, currentDocIndex, customName = null) => {
            if (customName && String(customName).trim() !== '') {
                let cleanCustom = String(customName).replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*]/g, '').trim();
                if (cleanCustom) {
                    return `${cleanCustom}.pdf`;
                }
            }
            const safeName = typName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
            const normalizedTypName = typName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            const trdOrder = typologyOrderMap[normalizedTypName] || 99;
            const paddedOrder = String(trdOrder).padStart(2, '0');
            
            if (currentDocIndex > 1) {
                return `${paddedOrder}_${safeName}_${currentDocIndex}.pdf`;
            }
            return `${paddedOrder}_${safeName}.pdf`;
        };

        const filename = generateFilename(typology_name, typologyCounts[typology_name], req.body.custom_filename);
        const outputPath = path.join(expDir, filename);

        const pdfBytes = await mergedPdf.save();
        fs.writeFileSync(outputPath, pdfBytes);

        if (backupExpDir) {
            try {
                const backupFilePath = path.join(backupExpDir, filename);
                fs.writeFileSync(backupFilePath, pdfBytes);
            } catch (e) {
                console.error("[BACKUP] Error guardando copia de seguridad:", e);
            }
        }

        // 6. SAVE RECORD TO DB
        const mergedPageCount = mergedPdf.getPageCount();
        const saveToDb = (filename, filePath, typologyName, descriptionText = null) => {
            return new Promise((resolve, reject) => {
                const query = `INSERT INTO documents (
                    organization_id, trd_series_id, trd_subseries_id, expediente_id,
                    filename, path, typology_name, document_date, origen, metadata_values, user_id, page_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                
                db.run(query, [
                    trdInfo?.dependency_id || null,
                    trdInfo?.series_id || null,
                    trdInfo?.id || null, // subseries_id
                    expediente.id || null,
                    filename,
                    filePath,
                    typologyName,
                    req.body.document_date || new Date().toISOString(),
                    origen,
                    descriptionText ? JSON.stringify({ description: descriptionText }) : null,
                    req.user?.id || null,
                    mergedPageCount
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        };

        await saveToDb(filename, outputPath, typology_name, description);

        // 7. CLEAN UP TEMP FILES
        for (const file of req.files) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }

        // Auto-assign
        if (req.user && expediente.id) {
            try {
                const { pool: pgPool } = require('../database_pg');
                const pkg = await pgPool.query(`
                    SELECT p.id FROM paquete_items pi
                    JOIN expediente_paquetes p ON p.id = pi.paquete_id
                    WHERE pi.expediente_id = $1 AND p.user_id = $2 LIMIT 1
                `, [expediente.id, req.user.id]);
                if (pkg.rowCount > 0) {
                    const paqId = pkg.rows[0].id;
                    await pgPool.query(`
                        INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, paquete_id, estado, observaciones)
                        VALUES ($1,$2,$2,$3,'En Proceso','Auto-asignado al cargar documento')
                        ON CONFLICT (expediente_id, user_id) DO UPDATE SET estado='En Proceso', assigned_at=CURRENT_TIMESTAMP
                    `, [expediente.id, req.user.id, paqId]);
                }
            } catch (autoErr) {
                console.warn('[AUTO-ASIGN] Error (no crítico):', autoErr.message);
            }
        }

        res.json({ success: true, file: filename, path: outputPath, storage_path: expDir });

    } catch (err) {
        console.error("Error merging and saving documents:", err);
        res.status(500).json({ error: err.message });
        if (req.files) {
            for (const file of req.files) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            }
        }
    }
});

// Helper: locate existing physical file on disk (with LOCAL_STORAGE_PATH and uploads/ fallback)
const resolveExistingPhysicalFile = async (doc) => {
    if (!doc) return null;
    let primaryPath = doc.path;
    if (primaryPath && fs.existsSync(primaryPath)) return primaryPath;

    if (primaryPath && process.env.LOCAL_STORAGE_PATH) {
        try {
            const dbStoragePath = await new Promise((resolve) => {
                db.get("SELECT value FROM system_settings WHERE key = 'storage_path'", [], (err, row) => resolve(row?.value || null));
            });
            if (dbStoragePath) {
                const normDbPath = primaryPath.replace(/\\/g, '/');
                const normDbStorage = dbStoragePath.replace(/\\/g, '/');
                if (normDbPath.startsWith(normDbStorage)) {
                    const relative = normDbPath.substring(normDbStorage.length);
                    const resolved = path.join(process.env.LOCAL_STORAGE_PATH, relative);
                    if (fs.existsSync(resolved)) return resolved;
                }
            }
        } catch (_) {}
    }

    if (doc.filename) {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        const findInDir = (dir) => {
            if (!fs.existsSync(dir)) return null;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        const found = findInDir(fullPath);
                        if (found) return found;
                    } else if (entry.isFile() && entry.name === doc.filename) {
                        return fullPath;
                    }
                }
            } catch (_) {}
            return null;
        };
        return findInDir(uploadsDir);
    }
    return null;
};

// GET /:id/shared-expedientes - List all expedientes linked to a shared document group
router.get('/:id/shared-expedientes', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM documents WHERE id = ?", [id], (err, row) => (err ? reject(err) : resolve(row)));
        });
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (!doc.shared_group_id) {
            const singleRows = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT d.id, d.filename, d.status, d.typology_name, d.document_date, d.origen, d.shared_group_id, d.source_document_id,
                            e.id AS expediente_id, e.expediente_code, e.title, e.subserie, e.metadata_values
                     FROM documents d
                     LEFT JOIN expedientes e ON d.expediente_id = e.id
                     WHERE d.id = ?`,
                    [doc.id],
                    (err, rows) => (err ? reject(err) : resolve(rows || []))
                );
            });
            return res.json({ shared_group_id: null, count: singleRows.length, data: singleRows });
        }

        const groupRows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT d.id, d.filename, d.status, d.typology_name, d.document_date, d.origen, d.shared_group_id, d.source_document_id,
                        e.id AS expediente_id, e.expediente_code, e.title, e.subserie, e.metadata_values
                 FROM documents d
                 LEFT JOIN expedientes e ON d.expediente_id = e.id
                 WHERE d.shared_group_id = ?
                 ORDER BY d.id ASC`,
                [doc.shared_group_id],
                (err, rows) => (err ? reject(err) : resolve(rows || []))
            );
        });
        res.json({ shared_group_id: doc.shared_group_id, count: groupRows.length, data: groupRows });
    } catch (err) {
        console.error('[GET /:id/shared-expedientes] Error:', err);
        res.status(500).json({ error: err.message || 'Error consultando expedientes vinculados.' });
    }
});

// POST /:id/share - Share/link an existing saved document into 1 or more additional expedientes
router.post('/:id/share', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let { expediente_ids, typology_name } = req.body || {};
        if (typeof expediente_ids === 'string') {
            try { expediente_ids = JSON.parse(expediente_ids); }
            catch (_) { expediente_ids = expediente_ids.split(',').map(s => s.trim()).filter(Boolean); }
        }
        const targetIds = Array.from(new Set((Array.isArray(expediente_ids) ? expediente_ids : []).map(Number).filter(n => Number.isFinite(n) && n > 0)));
        if (targetIds.length === 0) {
            return res.status(400).json({ error: 'Seleccione al menos un expediente destino para compartir el documento.' });
        }

        const doc = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM documents WHERE id = ?", [id], (err, row) => (err ? reject(err) : resolve(row)));
        });
        if (!doc) return res.status(404).json({ error: 'Documento origen no encontrado.' });

        const canAccessSource = await userCanManageDocOrExp(req.user, doc, null);
        if (!canAccessSource) {
            return res.status(403).json({ error: 'No tiene permisos sobre el documento origen.' });
        }

        const physicalSourcePath = await resolveExistingPhysicalFile(doc);
        if (!physicalSourcePath || !fs.existsSync(physicalSourcePath)) {
            return res.status(404).json({ error: 'El archivo PDF físico del documento origen no se encontró en el almacenamiento.' });
        }

        const { pool: pgPool } = require('../database_pg');
        const sharedGroupId = doc.shared_group_id || crypto.randomUUID();
        if (!doc.shared_group_id) {
            await pgPool.query('UPDATE documents SET shared_group_id = $1 WHERE id = $2', [sharedGroupId, doc.id]);
        }

        const existingRes = await pgPool.query(
            'SELECT expediente_id FROM documents WHERE shared_group_id = $1 AND expediente_id IS NOT NULL',
            [sharedGroupId]
        );
        const existingExpSet = new Set(existingRes.rows.map(r => Number(r.expediente_id)));
        if (doc.expediente_id) existingExpSet.add(Number(doc.expediente_id));

        const effectiveTypology = (typology_name && String(typology_name).trim()) ? String(typology_name).trim() : doc.typology_name;
        const rootSourceDocId = doc.source_document_id || doc.id;

        const createdDocs = [];
        const skipped = [];

        for (const expId of targetIds) {
            if (existingExpSet.has(expId)) {
                skipped.push({ expediente_id: expId, reason: 'Ya vinculado en este expediente' });
                continue;
            }

            const canManageTarget = await userCanManageDocOrExp(req.user, null, expId);
            if (!canManageTarget) {
                skipped.push({ expediente_id: expId, reason: 'Sin permisos sobre este expediente' });
                continue;
            }

            const targetDirs = await resolveTargetDirsForExpediente(expId, effectiveTypology);
            const tempName = `shared_${Date.now()}_${expId}_${path.basename(doc.filename || 'documento.pdf')}`;
            const targetPath = path.join(targetDirs.expDir, tempName);
            linkOrCopyFileSync(physicalSourcePath, targetPath);

            if (targetDirs.backupExpDir) {
                try { linkOrCopyFileSync(physicalSourcePath, path.join(targetDirs.backupExpDir, tempName)); } catch (_) {}
            }

            const ins = await pgPool.query(
                `INSERT INTO documents (
                    organization_id, trd_series_id, trd_subseries_id, expediente_id,
                    filename, path, typology_name, document_date, origen, metadata_values,
                    user_id, status, shared_group_id, source_document_id, page_count
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pendiente',$12,$13,$14)
                RETURNING id`,
                [
                    targetDirs.trdInfo?.dependency_id || doc.organization_id || null,
                    targetDirs.trdInfo?.series_id || doc.trd_series_id || null,
                    targetDirs.trdInfo?.id || doc.trd_subseries_id || null,
                    expId,
                    tempName,
                    targetPath,
                    effectiveTypology,
                    doc.document_date || new Date().toISOString(),
                    doc.origen || 'ELECTRONICO',
                    doc.metadata_values || null,
                    req.user?.id || doc.user_id || null,
                    sharedGroupId,
                    rootSourceDocId,
                    doc.page_count || null
                ]
            );
            const newDocId = ins.rows[0].id;
            await fixExpedienteNames(expId);

            const refreshed = await pgPool.query(
                'SELECT id, filename, path, typology_name, status, expediente_id, shared_group_id FROM documents WHERE id = $1',
                [newDocId]
            );
            if (refreshed.rows[0]) createdDocs.push(refreshed.rows[0]);
            existingExpSet.add(expId);
        }

        const totalRes = await pgPool.query('SELECT COUNT(*)::int AS cnt FROM documents WHERE shared_group_id = $1', [sharedGroupId]);
        res.json({
            success: true,
            shared_group_id: sharedGroupId,
            shared_count: totalRes.rows[0]?.cnt || existingExpSet.size,
            created_count: createdDocs.length,
            created: createdDocs,
            skipped
        });
    } catch (err) {
        console.error('[POST /:id/share] Error:', err);
        res.status(500).json({ error: err.message || 'Error compartiendo documento.' });
    }
});

// POST /classify-multi-expediente - Upload 1 file (or merge 2+ files) and save/link across 1 or N expedientes
router.post('/classify-multi-expediente', requireAuth, upload.array('files'), async (req, res) => {
    const cleanupUploadedFiles = () => {
        if (Array.isArray(req.files)) {
            for (const f of req.files) {
                if (f && f.path && fs.existsSync(f.path)) {
                    try { fs.unlinkSync(f.path); } catch (_) {}
                }
            }
        }
    };

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se recibieron archivos para guardar.' });
        }

        let {
            expediente_ids,
            typology_name,
            document_date,
            origen = 'ELECTRONICO',
            description = '',
            custom_filename = ''
        } = req.body || {};

        if (typeof expediente_ids === 'string') {
            try { expediente_ids = JSON.parse(expediente_ids); }
            catch (_) { expediente_ids = expediente_ids.split(',').map(s => s.trim()).filter(Boolean); }
        }
        const targetExpIds = Array.from(new Set((Array.isArray(expediente_ids) ? expediente_ids : []).map(Number).filter(n => Number.isFinite(n) && n > 0)));
        if (targetExpIds.length === 0) {
            cleanupUploadedFiles();
            return res.status(400).json({ error: 'Debe asignar al menos un expediente.' });
        }
        if (!typology_name || !String(typology_name).trim()) {
            cleanupUploadedFiles();
            return res.status(400).json({ error: 'Debe seleccionar una tipología documental TRD.' });
        }
        const finalTypology = String(typology_name).trim();

        // Verify permissions across all selected expedientes upfront
        for (const expId of targetExpIds) {
            const allowed = await userCanManageDocOrExp(req.user, null, expId);
            if (!allowed) {
                cleanupUploadedFiles();
                return res.status(403).json({ error: `No tiene permisos para cargar documentos en el expediente ID ${expId}.` });
            }
        }

        // Build single normalized PDF (merging if multiple files were passed, converting images to PDF pages)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
        let finalPdfBytes = null;
        let finalPageCount = 1;

        if (req.files.length === 1) {
            const singleFile = req.files[0];
            const ext = path.extname(singleFile.originalname).toLowerCase().trim();
            if (imageExtensions.includes(ext)) {
                const pdfDoc = await PDFDocument.create();
                if (ext === '.tif' || ext === '.tiff') {
                    const metadata = await sharp(singleFile.path).metadata();
                    const pages = metadata.pages || 1;
                    for (let i = 0; i < pages; i++) {
                        const pageBuffer = await sharp(singleFile.path, { page: i }).jpeg().toBuffer();
                        const img = await pdfDoc.embedJpg(pageBuffer);
                        const page = pdfDoc.addPage([img.width, img.height]);
                        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                    }
                } else {
                    const imgBytes = fs.readFileSync(singleFile.path);
                    const img = ext === '.png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
                    const page = pdfDoc.addPage([img.width, img.height]);
                    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                }
                finalPageCount = pdfDoc.getPageCount();
                finalPdfBytes = await pdfDoc.save();
            } else {
                const rawBytes = fs.readFileSync(singleFile.path);
                const validated = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
                finalPageCount = validated.getPageCount();
                finalPdfBytes = await validated.save();
            }
        } else {
            const mergedPdf = await PDFDocument.create();
            for (const file of req.files) {
                const ext = path.extname(file.originalname).toLowerCase().trim();
                if (imageExtensions.includes(ext)) {
                    if (ext === '.tif' || ext === '.tiff') {
                        const metadata = await sharp(file.path).metadata();
                        const pages = metadata.pages || 1;
                        for (let i = 0; i < pages; i++) {
                            const pageBuffer = await sharp(file.path, { page: i }).jpeg().toBuffer();
                            const img = await mergedPdf.embedJpg(pageBuffer);
                            const page = mergedPdf.addPage([img.width, img.height]);
                            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                        }
                    } else {
                        const imgBytes = fs.readFileSync(file.path);
                        const img = ext === '.png' ? await mergedPdf.embedPng(imgBytes) : await mergedPdf.embedJpg(imgBytes);
                        const page = mergedPdf.addPage([img.width, img.height]);
                        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                    }
                } else {
                    const fileBytes = fs.readFileSync(file.path);
                    const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
                    const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                    copiedPages.forEach(p => mergedPdf.addPage(p));
                }
            }
            finalPageCount = mergedPdf.getPageCount();
            finalPdfBytes = await mergedPdf.save();
        }

        cleanupUploadedFiles();

        const { pool: pgPool } = require('../database_pg');
        const sharedGroupId = targetExpIds.length > 1 ? crypto.randomUUID() : null;
        const metaJson = description && String(description).trim()
            ? JSON.stringify({ description: String(description).trim() })
            : null;
        const docDateVal = document_date || new Date().toISOString();

        let primarySavedPath = null;
        let rootDocId = null;
        const createdDocs = [];

        for (let idx = 0; idx < targetExpIds.length; idx++) {
            const expId = targetExpIds[idx];
            const targetDirs = await resolveTargetDirsForExpediente(expId, finalTypology);
            const tempName = `batch_${Date.now()}_${idx}_${expId}.pdf`;
            const targetPath = path.join(targetDirs.expDir, tempName);

            if (!primarySavedPath) {
                fs.writeFileSync(targetPath, finalPdfBytes);
                primarySavedPath = targetPath;
            } else {
                linkOrCopyFileSync(primarySavedPath, targetPath);
            }

            if (targetDirs.backupExpDir) {
                try {
                    const backupTarget = path.join(targetDirs.backupExpDir, tempName);
                    linkOrCopyFileSync(primarySavedPath, backupTarget);
                } catch (_) {}
            }

            const ins = await pgPool.query(
                `INSERT INTO documents (
                    organization_id, trd_series_id, trd_subseries_id, expediente_id,
                    filename, path, typology_name, document_date, origen, metadata_values,
                    user_id, status, shared_group_id, source_document_id, page_count
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pendiente',$12,$13,$14)
                RETURNING id`,
                [
                    targetDirs.trdInfo?.dependency_id || null,
                    targetDirs.trdInfo?.series_id || null,
                    targetDirs.trdInfo?.id || null,
                    expId,
                    tempName,
                    targetPath,
                    finalTypology,
                    docDateVal,
                    origen || 'ELECTRONICO',
                    metaJson,
                    req.user?.id || null,
                    sharedGroupId,
                    idx === 0 ? null : rootDocId,
                    finalPageCount
                ]
            );
            const insertedId = ins.rows[0].id;
            if (idx === 0) rootDocId = insertedId;

            await fixExpedienteNames(expId);

            // Update primarySavedPath after fixExpedienteNames renamed the first file!
            if (idx === 0) {
                const firstAfterRename = await pgPool.query('SELECT path FROM documents WHERE id = $1', [insertedId]);
                if (firstAfterRename.rows[0]?.path && fs.existsSync(firstAfterRename.rows[0].path)) {
                    primarySavedPath = firstAfterRename.rows[0].path;
                }
            }

            // Apply custom filename override when uploading to a single expediente
            if (targetExpIds.length === 1 && custom_filename && String(custom_filename).trim()) {
                const cleanCustom = String(custom_filename).replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*]/g, '').trim();
                if (cleanCustom && cleanCustom.length < 120) {
                    const cur = await pgPool.query('SELECT filename, path FROM documents WHERE id = $1', [insertedId]);
                    const row = cur.rows[0];
                    if (row && row.path) {
                        const desiredFilename = `${cleanCustom}.pdf`;
                        const desiredPath = path.join(path.dirname(row.path), desiredFilename);
                        if (row.filename !== desiredFilename) {
                            try {
                                if (fs.existsSync(row.path) && row.path !== desiredPath) {
                                    fs.renameSync(row.path, desiredPath);
                                }
                                await pgPool.query('UPDATE documents SET filename = $1, path = $2 WHERE id = $3', [desiredFilename, desiredPath, insertedId]);
                            } catch (_) {}
                        }
                    }
                }
            }

            // Auto-assign package if applicable
            if (req.user) {
                try {
                    const pkg = await pgPool.query(
                        `SELECT p.id FROM paquete_items pi
                         JOIN expediente_paquetes p ON p.id = pi.paquete_id
                         WHERE pi.expediente_id = $1 AND p.user_id = $2 LIMIT 1`,
                        [expId, req.user.id]
                    );
                    if (pkg.rowCount > 0) {
                        await pgPool.query(
                            `INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, paquete_id, estado, observaciones)
                             VALUES ($1,$2,$2,$3,'En Proceso','Auto-asignado en clasificación masiva')
                             ON CONFLICT (expediente_id, user_id) DO UPDATE SET estado='En Proceso', assigned_at=CURRENT_TIMESTAMP`,
                            [expId, req.user.id, pkg.rows[0].id]
                        );
                    }
                } catch (_) {}
            }

            const finalRow = await pgPool.query(
                `SELECT d.id, d.filename, d.path, d.typology_name, d.status, d.expediente_id, d.shared_group_id,
                        e.expediente_code, e.title AS expediente_title
                 FROM documents d
                 LEFT JOIN expedientes e ON d.expediente_id = e.id
                 WHERE d.id = $1`,
                [insertedId]
            );
            if (finalRow.rows[0]) createdDocs.push(finalRow.rows[0]);
        }

        res.json({
            success: true,
            count: createdDocs.length,
            shared_group_id: sharedGroupId,
            documents: createdDocs
        });
    } catch (err) {
        cleanupUploadedFiles();
        console.error('[POST /classify-multi-expediente] Error:', err);
        res.status(500).json({ error: err.message || 'Error al clasificar y guardar el documento.' });
    }
});

// ============================================================================
// INVENTARIO DOCUMENTAL INSTITUCIONAL SENA POR USUARIO
// Formatos Oficiales Intactos:
//   1) GD-F-004 Versión: 06 — Formato Único de Inventario Documental (FUID)
//   2) GD-F-003 Versión: 04 — Hoja de Control por Expediente
// ============================================================================

const SENA_LOGO_PNG_B64 = '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';

const sanitizeWinAnsi = (val) => {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[“”«»]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/•/g, '*')
        .replace(/…/g, '...')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const wrapPdfText = (rawText, font, fontSize, maxWidth, maxLines = 4) => {
    const clean = sanitizeWinAnsi(rawText);
    if (!clean) return [''];

    const safeMaxW = Math.max(8, maxWidth);
    const splitLongToken = (token) => {
        if (font.widthOfTextAtSize(token, fontSize) <= safeMaxW) return [token];
        const parts = [];
        let cur = '';
        for (const ch of token) {
            const test = cur + ch;
            if (cur && font.widthOfTextAtSize(test, fontSize) > safeMaxW) {
                parts.push(cur);
                cur = ch;
            } else {
                cur = test;
            }
        }
        if (cur) parts.push(cur);
        return parts;
    };

    const words = clean.split(' ').flatMap(splitLongToken);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (currentLine && font.widthOfTextAtSize(candidate, fontSize) > safeMaxW) {
            lines.push(currentLine);
            currentLine = word;
            if (lines.length >= maxLines) break;
        } else {
            currentLine = candidate;
        }
    }
    if (lines.length < maxLines && currentLine) {
        lines.push(currentLine);
    }
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
        let last = lines[maxLines - 1];
        while (last.length > 2 && font.widthOfTextAtSize(last + '...', fontSize) > safeMaxW) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '...';
    }
    return lines.length > 0 ? lines : [''];
};

const ensurePageCountsForDocs = async (rows, pgPool, maxDeepReads = 350) => {
    let deepReads = 0;
    for (const row of rows) {
        if (row.page_count && Number(row.page_count) > 0) {
            row.page_count = Number(row.page_count);
            continue;
        }
        let detected = null;
        try {
            const physPath = await resolveExistingPhysicalFile(row);
            if (physPath && fs.existsSync(physPath)) {
                const buf = fs.readFileSync(physPath);
                if (deepReads < maxDeepReads) {
                    deepReads++;
                    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
                    detected = pdf.getPageCount();
                } else {
                    const m = buf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g);
                    detected = m && m.length > 0 ? m.length : 1;
                }
                if (detected && detected > 0) {
                    await pgPool.query('UPDATE documents SET page_count = $1 WHERE id = $2', [detected, row.id]).catch(() => {});
                }
            }
        } catch (_) {}
        row.page_count = detected && detected > 0 ? detected : 1;
    }
};

const formatShortDate = (val) => {
    if (!val) return '';
    try {
        const str = String(val).trim();
        const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (mIso) return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
        const d = new Date(val);
        if (isNaN(d.getTime())) return str.slice(0, 10);
        return d.toISOString().slice(0, 10);
    } catch (_) {
        return String(val).slice(0, 10);
    }
};

const formatSlashDate = (val) => {
    const iso = formatShortDate(val);
    return iso ? iso.replace(/-/g, '/') : '';
};

const INTERNAL_EXP_META_KEYS = new Set([
    'hoja_control_documentos',
    'responsable_hoja_control',
    'regional_code',
    'center_code',
    'section_code',
    'regional_name',
    'center_name',
    'section_name'
]);

const buildFullExpedienteIdentification = (titleRaw, metadataRaw, fallbackLabel = '') => {
    const cleanTitle = String(titleRaw || '').trim();
    const normTitle = cleanTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const hasRealTitle = Boolean(cleanTitle)
        && normTitle !== 'sin titulo'
        && normTitle !== 's/t'
        && normTitle !== 'null'
        && normTitle !== 'undefined';

    const metaValues = [];
    if (metadataRaw) {
        try {
            const obj = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                const orderedKeys = [
                    'valor1', 'valor2', 'valor3', 'valor4', 'valor5', 'valor6', 'valor7', 'valor8',
                    ...Object.keys(obj).filter(k => !/^valor[1-8]$/.test(k))
                ];
                const seenKeys = new Set();
                for (const key of orderedKeys) {
                    if (seenKeys.has(key) || INTERNAL_EXP_META_KEYS.has(key)) continue;
                    seenKeys.add(key);
                    const val = obj[key];
                    if ((typeof val === 'string' || typeof val === 'number') && String(val).trim() !== '') {
                        metaValues.push(String(val).trim());
                    }
                }
            }
        } catch (_) {}
    }

    const metaJoined = metaValues.join(', ');

    if (hasRealTitle && metaJoined) {
        if (metaJoined.toLowerCase() === cleanTitle.toLowerCase()) {
            const fb = String(fallbackLabel || '').trim();
            return fb && fb.toLowerCase() !== cleanTitle.toLowerCase()
                ? `${fb} - ${cleanTitle}`
                : cleanTitle;
        }
        return `${cleanTitle} - ${metaJoined}`;
    }
    if (hasRealTitle) {
        return cleanTitle;
    }
    if (metaJoined) {
        return metaJoined;
    }
    return String(fallbackLabel || '').trim();
};

const resolveInstitutionalSupport = (storageType, docOrigen) => {
    const raw = `${storageType || ''} ${docOrigen || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (raw.includes('hibrido')) {
        return { sop: 'HIBRIDO', otro: '', isPhysical: true };
    }
    if (raw.includes('fisico') && !raw.includes('electronico') && !raw.includes('digital')) {
        return { sop: 'FISICO', otro: '', isPhysical: true };
    }
    return { sop: 'ELECTRONICO', otro: 'X', isPhysical: false };
};

const buildInventoryDataset = async (req, maxDeepReads = 300) => {
    const { pool: pgPool } = require('../database_pg');
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

    const rawUserId = req.query.user_id;
    const effectiveUserId = isAdmin
        ? (rawUserId === 'all' ? 'all' : Number(rawUserId || req.user.id))
        : Number(req.user.id);

    const rawMode = String(req.query.mode || 'fuid').toLowerCase();
    const mode = (rawMode === 'hoja_control' || rawMode === 'detallado' || rawMode === 'gdf003')
        ? 'hoja_control'
        : 'fuid';

    const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim() : '';
    const subserie = req.query.subserie ? String(req.query.subserie).trim() : '';
    const statusFilter = req.query.status_filter ? String(req.query.status_filter).trim() : 'all';
    const search = req.query.search ? String(req.query.search).trim() : '';
    const includeAssigned = req.query.include_assigned !== '0' && req.query.include_assigned !== 'false';
    const defaultFrecuencia = sanitizeWinAnsi(req.query.frecuencia || 'ALTA') || 'ALTA';

    const orgRes = await pgPool.query('SELECT * FROM organization_structure ORDER BY id ASC');
    const orgRows = orgRes.rows || [];
    const firstOrg = orgRows[0] || {
        regional_code: '68',
        regional_name: 'REGIONAL SANTANDER',
        center_code: '9224',
        center_name: 'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL',
        section_code: '9224',
        section_name: 'SUBDIRECCION DE CENTROS DE FORMACION PROFESIONAL',
        subsection_code: '',
        subsection_name: ''
    };

    let targetUser = {
        id: 'all',
        full_name: '',
        document_no: '',
        area: 'GESTIÓN DOCUMENTAL',
        position: '',
        role: 'all'
    };

    if (effectiveUserId !== 'all' && Number.isFinite(effectiveUserId)) {
        const uRes = await pgPool.query(
            'SELECT id, full_name, document_no, area, position, role FROM users WHERE id = $1 LIMIT 1',
            [effectiveUserId]
        );
        if (uRes.rows[0]) {
            targetUser = uRes.rows[0];
        } else {
            targetUser = {
                id: effectiveUserId,
                full_name: req.user?.full_name || req.user?.name || '',
                document_no: req.user?.document_no || '',
                area: '',
                position: '',
                role: req.user?.role || 'user'
            };
        }
    }

    const where = [];
    const params = [];

    if (effectiveUserId !== 'all' && Number.isFinite(effectiveUserId)) {
        params.push(effectiveUserId);
        const pIdx = params.length;
        if (includeAssigned) {
            where.push(`(
                d.user_id = $${pIdx}
                OR (
                    d.expediente_id IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM expediente_assignments ea
                        WHERE ea.expediente_id = d.expediente_id AND ea.user_id = $${pIdx}
                    )
                )
            )`);
        } else {
            where.push(`d.user_id = $${pIdx}`);
        }
    }

    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        params.push(dateFrom);
        where.push(`d.created_at >= $${params.length}::date`);
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        params.push(dateTo);
        where.push(`d.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (statusFilter === 'Cargado' || statusFilter === 'Pendiente') {
        params.push(statusFilter);
        where.push(`d.status = $${params.length}`);
    }
    if (subserie && subserie !== 'all') {
        params.push(`%${subserie}%`);
        where.push(`(COALESCE(e.subserie, '') ILIKE $${params.length} OR COALESCE(sub.subseries_code, '') ILIKE $${params.length} OR COALESCE(ser.series_code, '') ILIKE $${params.length})`);
    }
    if (search) {
        params.push(`%${search}%`);
        const sIdx = params.length;
        where.push(`(
            COALESCE(e.expediente_code, '') ILIKE $${sIdx}
            OR COALESCE(e.title, '') ILIKE $${sIdx}
            OR COALESCE(e.metadata_values::text, '') ILIKE $${sIdx}
            OR COALESCE(d.filename, '') ILIKE $${sIdx}
            OR COALESCE(d.typology_name, '') ILIKE $${sIdx}
        )`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
        SELECT
            d.id,
            d.expediente_id,
            d.organization_id,
            d.filename,
            d.path,
            d.typology_name,
            d.document_date,
            d.created_at,
            d.load_date,
            d.status,
            d.onbase_verified,
            d.origen,
            d.page_count,
            d.user_id,
            u.full_name AS author_name,
            e.expediente_code,
            e.title AS expediente_title,
            e.subserie AS expediente_subserie,
            e.box_id,
            e.storage_type,
            e.opening_date,
            e.dependencia AS expediente_dependencia,
            e.metadata_values AS expediente_metadata,
            COALESCE(sub.subseries_code, ser.series_code, e.subserie, '') AS trd_code,
            COALESCE(sub.subseries_name, '') AS subseries_name,
            COALESCE(sub.subseries_code, '') AS subseries_code,
            COALESCE(ser.series_name, '') AS series_name,
            COALESCE(ser.series_code, '') AS series_code,
            ser.dependency_id AS ser_dependency_id
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN LATERAL (
            SELECT ts.id, ts.series_id, ts.subseries_code, ts.subseries_name
            FROM trd_subseries ts
            WHERE ts.id = d.trd_subseries_id
               OR e.subserie = ts.subseries_code
               OR e.subserie ILIKE '%-' || ts.subseries_code
            ORDER BY (ts.id = d.trd_subseries_id) DESC, ts.id ASC
            LIMIT 1
        ) sub ON true
        LEFT JOIN LATERAL (
            SELECT sr.id, sr.series_code, sr.series_name, sr.dependency_id
            FROM trd_series sr
            WHERE sr.id = d.trd_series_id
               OR sr.id = sub.series_id
               OR e.subserie = sr.series_code
            ORDER BY (sr.id = d.trd_series_id) DESC, (sr.id = sub.series_id) DESC, sr.id ASC
            LIMIT 1
        ) ser ON true
        ${whereSql}
        ORDER BY
            COALESCE(NULLIF(TRIM(e.subserie), ''), 'ZZZZ') ASC,
            COALESCE(NULLIF(TRIM(e.expediente_code), ''), COALESCE(NULLIF(TRIM(e.title), ''), 'ZZZZ')) ASC,
            d.filename ASC,
            d.created_at ASC,
            d.id ASC
        LIMIT 15000
    `;

    const resDocs = await pgPool.query(sql, params);
    const docs = resDocs.rows || [];

    await ensurePageCountsForDocs(docs, pgPool, maxDeepReads);

    const orgById = new Map(orgRows.map(o => [Number(o.id), o]));
    const orgCounts = new Map();
    const subseriesSet = new Map();
    let totalFolios = 0;
    let cargadosAes = 0;
    let pendientesAes = 0;
    const expGroupsMap = new Map();

    const inferOrgForDoc = (d) => {
        const subTxt = String(d.expediente_subserie || d.trd_code || '');
        if (subTxt.includes('9224.4')) return orgRows.find(o => o.subsection_code === '9224.4') || firstOrg;
        if (subTxt.includes('9224.2')) return orgRows.find(o => o.subsection_code === '9224.2') || firstOrg;
        const oid = Number(d.organization_id || d.ser_dependency_id || 0);
        if (oid && orgById.has(oid)) return orgById.get(oid);
        return firstOrg;
    };

    for (const d of docs) {
        const fol = Number(d.page_count) > 0 ? Number(d.page_count) : 1;
        totalFolios += fol;
        if (d.status === 'Cargado') cargadosAes++;
        else pendientesAes++;

        const matchedOrg = inferOrgForDoc(d);
        if (matchedOrg && matchedOrg.id) {
            orgCounts.set(matchedOrg.id, (orgCounts.get(matchedOrg.id) || 0) + 1);
        }

        const subCode = String(d.expediente_subserie || d.trd_code || '').trim();
        if (subCode && !subseriesSet.has(subCode)) {
            subseriesSet.set(subCode, {
                code: subCode,
                name: d.subseries_name || d.series_name || subCode
            });
        }

        const gKey = d.expediente_id ? `EXP_${d.expediente_id}` : `NOEXP_${d.id}`;
        if (!expGroupsMap.has(gKey)) {
            const fullIdentificacion = buildFullExpedienteIdentification(
                d.expediente_title,
                d.expediente_metadata,
                d.subseries_name || d.series_name || d.filename || ''
            );
            expGroupsMap.set(gKey, {
                expediente_id: d.expediente_id || null,
                codigo_trd: subCode || '',
                series_name: d.series_name || '',
                series_code: d.series_code || '',
                subseries_name: d.subseries_name || '',
                subseries_code: d.subseries_code || subCode || '',
                expediente_code: d.expediente_code || '',
                titulo: fullIdentificacion,
                box_id: d.box_id || '',
                storage_type: d.storage_type || 'ELECTRONICO',
                origen: d.origen || 'ELECTRONICO',
                org: matchedOrg,
                minTime: null,
                maxTime: null,
                minDateStr: '',
                maxDateStr: '',
                num_docs: 0,
                num_folios: 0,
                cargados: 0,
                pendientes: 0,
                docs: []
            });
        }

        const g = expGroupsMap.get(gKey);
        g.num_docs += 1;
        g.num_folios += fol;
        if (d.status === 'Cargado') g.cargados += 1;
        else g.pendientes += 1;
        g.docs.push(d);

        const candidateDate = d.document_date || d.created_at || d.opening_date;
        const ds = formatShortDate(candidateDate);
        if (ds) {
            const ts = new Date(ds).getTime();
            if (!isNaN(ts)) {
                if (g.minTime === null || ts < g.minTime) {
                    g.minTime = ts;
                    g.minDateStr = ds;
                }
                if (g.maxTime === null || ts > g.maxTime) {
                    g.maxTime = ts;
                    g.maxDateStr = ds;
                }
            }
        }
    }

    // Dominant organization for official GD-F-004 / GD-F-003 header
    let dominantOrg = firstOrg;
    let bestCount = -1;
    for (const [oid, cnt] of orgCounts.entries()) {
        if (cnt > bestCount && orgById.has(oid)) {
            bestCount = cnt;
            dominantOrg = orgById.get(oid);
        }
    }

    const buildOficinaName = (org) => {
        let ofi = org?.section_name || 'SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL';
        if (org?.subsection_name) {
            ofi += ` / ${org.subsection_name}`;
        }
        return ofi;
    };

    const buildOficinaCode = (org) => {
        const reg = org?.regional_code || '68';
        const cen = org?.center_code || '9224';
        const sub = org?.subsection_code || '';
        if (sub) return sub.startsWith(reg) ? sub : `${reg}.${sub}`;
        return `${reg}.${cen}`;
    };

    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);

    const headerDefaults = {
        sede: dominantOrg.regional_name || 'REGIONAL SANTANDER',
        cod_sede: dominantOrg.regional_code || '68',
        unidad_administrativa: dominantOrg.center_name || 'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL',
        cod_unidad: `${dominantOrg.regional_code || '68'}.${dominantOrg.center_code || '9224'}`,
        oficina_productora: buildOficinaName(dominantOrg),
        cod_oficina: buildOficinaCode(dominantOrg),
        reg_anio: '',
        reg_mes: '',
        reg_dia: '',
        nut: '',
        objeto: 'ARCHIVO DE GESTIÓN'
    };

    const signatureDefaults = {
        elaborado_nombre: targetUser.full_name || '',
        elaborado_cargo: targetUser.position || (targetUser.full_name ? 'APOYO GESTIÓN DOCUMENTAL' : ''),
        elaborado_fecha: targetUser.full_name ? todayISO : '',
        entregado_nombre: targetUser.full_name || '',
        entregado_cargo: targetUser.position || '',
        entregado_fecha: targetUser.full_name ? todayISO : '',
        recibido_nombre: '',
        recibido_cargo: '',
        recibido_fecha: ''
    };

    // Exact 14-column GD-F-004 Versión: 06 rows
    const fuidRows = Array.from(expGroupsMap.values()).map((g, idx) => {
        const sup = resolveInstitutionalSupport(g.storage_type, g.origen);
        const notaParts = [];
        if (g.expediente_code) notaParts.push(g.expediente_code);
        if (g.num_docs > 0) notaParts.push(`${g.num_docs} doc${g.num_docs === 1 ? '' : 's'}`);
        return {
            n: idx + 1,
            cod: g.codigo_trd || '',
            nombre: g.titulo || '',
            ini: g.minDateStr || '',
            fin: g.maxDateStr || '',
            caja: sup.isPhysical ? (g.box_id || '') : '',
            carp: '',
            tomo: '',
            otro: sup.otro,
            del: g.num_folios > 0 ? '1' : '',
            al: g.num_folios > 0 ? String(g.num_folios) : '',
            sop: sup.sop,
            frec: defaultFrecuencia,
            notas: notaParts.join(' - '),
            expediente_id: g.expediente_id,
            expediente_code: g.expediente_code,
            num_docs: g.num_docs,
            num_folios: g.num_folios
        };
    });

    // Exact GD-F-003 Versión: 04 groups (one Hoja de Control per Expediente)
    const hojaControlGroups = Array.from(expGroupsMap.values()).map((g) => {
        let curFolio = 1;
        const org = g.org || dominantOrg;
        const docItems = g.docs.map((d) => {
            const fol = Number(d.page_count) > 0 ? Number(d.page_count) : 1;
            const startFol = curFolio;
            const endFol = curFolio + fol - 1;
            curFolio += fol;
            const sup = resolveInstitutionalSupport(g.storage_type, d.origen);
            return {
                id: d.id,
                fecha: formatSlashDate(d.document_date || d.created_at),
                tipo: d.typology_name || d.filename || '',
                fisico: sup.sop === 'FISICO' ? 'X' : '',
                electronico: sup.sop !== 'FISICO' ? 'X' : '',
                folios: `${startFol} - ${endFol}`,
                obs: g.expediente_code || ''
            };
        });

        const identParts = [g.titulo, g.expediente_code].filter(Boolean);
        return {
            expediente_id: g.expediente_id,
            expediente_code: g.expediente_code,
            sede: org.regional_name || headerDefaults.sede,
            cod_sede: org.regional_code || headerDefaults.cod_sede,
            unidad_administrativa: org.center_name || headerDefaults.unidad_administrativa,
            cod_unidad: `${org.regional_code || '68'}.${org.center_code || '9224'}`,
            oficina_productora: buildOficinaName(org),
            cod_oficina: buildOficinaCode(org),
            series_name: g.series_name || '',
            series_code: g.series_code || '',
            subseries_name: g.subseries_name || '',
            subseries_code: g.subseries_code || g.codigo_trd || '',
            identificacion_expediente: identParts.join(' - '),
            responsable: targetUser.full_name || (g.docs[0]?.author_name || ''),
            documentos: docItems
        };
    });

    let assignedSinDocs = 0;
    try {
        if (effectiveUserId !== 'all' && Number.isFinite(effectiveUserId)) {
            const emptyRes = await pgPool.query(
                `SELECT COUNT(DISTINCT ea.expediente_id)::int AS c
                 FROM expediente_assignments ea
                 WHERE ea.user_id = $1
                   AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = ea.expediente_id)`,
                [effectiveUserId]
            );
            assignedSinDocs = emptyRes.rows?.[0]?.c || 0;
        } else {
            const emptyRes = await pgPool.query(
                `SELECT COUNT(DISTINCT ea.expediente_id)::int AS c
                 FROM expediente_assignments ea
                 WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = ea.expediente_id)`
            );
            assignedSinDocs = emptyRes.rows?.[0]?.c || 0;
        }
    } catch (_) {}

    return {
        mode,
        targetUser,
        effectiveUserId,
        dateFrom,
        dateTo,
        subserie,
        statusFilter,
        search,
        includeAssigned,
        headerDefaults,
        signatureDefaults,
        kpis: {
            total_expedientes: expGroupsMap.size,
            total_documents: docs.length,
            total_folios: totalFolios,
            cargados_aes: cargadosAes,
            pendientes_aes: pendientesAes,
            assigned_sin_docs: assignedSinDocs
        },
        subseriesList: Array.from(subseriesSet.values()),
        fuidRows,
        hojaControlGroups
    };
};

// Helper to draw an institutional black-bordered table cell in pdf-lib
const drawBlackBoxCell = (page, x, topY, w, h, opts = {}) => {
    const {
        text = '',
        lines = null,
        font,
        fontSize = 8,
        align = 'left',
        valign = 'middle',
        padX = 3,
        padTop = 4,
        lineHeight = null,
        maxLines = 3,
        drawRightBorder = true,
        drawLeftBorder = true,
        drawTopBorder = true,
        drawBottomBorder = true,
        borderWidth = 0.75
    } = opts;

    const BLACK = rgb(0, 0, 0);
    const WHITE = rgb(1, 1, 1);
    const bottomY = topY - h;

    page.drawRectangle({
        x,
        y: bottomY,
        width: w,
        height: h,
        color: WHITE
    });

    if (drawTopBorder) {
        page.drawLine({ start: { x, y: topY }, end: { x: x + w, y: topY }, thickness: borderWidth, color: BLACK });
    }
    if (drawBottomBorder) {
        page.drawLine({ start: { x, y: bottomY }, end: { x: x + w, y: bottomY }, thickness: borderWidth, color: BLACK });
    }
    if (drawLeftBorder) {
        page.drawLine({ start: { x, y: topY }, end: { x, y: bottomY }, thickness: borderWidth, color: BLACK });
    }
    if (drawRightBorder) {
        page.drawLine({ start: { x: x + w, y: topY }, end: { x: x + w, y: bottomY }, thickness: borderWidth, color: BLACK });
    }

    if (!font) return;

    const renderedLines = Array.isArray(lines)
        ? lines.map(l => sanitizeWinAnsi(l))
        : wrapPdfText(text, font, fontSize, w - padX * 2, maxLines);

    const nonEmpty = renderedLines.filter(l => l !== '');
    if (nonEmpty.length === 0) return;

    const lh = lineHeight || (fontSize * 1.18);
    const blockH = renderedLines.length * lh;
    let firstBaselineY;
    if (valign === 'top') {
        firstBaselineY = topY - padTop - fontSize * 0.82;
    } else if (valign === 'bottom') {
        firstBaselineY = bottomY + 4 + (renderedLines.length - 1) * lh;
    } else {
        firstBaselineY = bottomY + (h + blockH) / 2 - fontSize * 0.86;
    }

    for (let i = 0; i < renderedLines.length; i++) {
        const ln = renderedLines[i];
        if (!ln) continue;
        const tw = font.widthOfTextAtSize(ln, fontSize);
        let tx = x + padX;
        if (align === 'center') {
            tx = x + Math.max(1.5, (w - tw) / 2);
        } else if (align === 'right') {
            tx = x + Math.max(1.5, w - padX - tw);
        }
        page.drawText(ln, {
            x: tx,
            y: firstBaselineY - i * lh,
            size: fontSize,
            font,
            color: BLACK
        });
    }
};

// ============================================================================
// RENDERIZADOR OFICIAL SENA 1: GD-F-004 Versión: 06 (Horizontal Tamaño Carta)
// Formato Único de Inventario Documental — 100% idéntico a InventarioDocumental.jsx
// ============================================================================
const renderOfficialGdF004Pdf = async ({ header = {}, signatures = {}, filas = [] }) => {
    const pdfDoc = await PDFDocument.create();
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const senaLogo = await pdfDoc.embedPng(Buffer.from(SENA_LOGO_PNG_B64, 'base64'));

    const PAGE_W = 792; // Letter Landscape
    const PAGE_H = 612;
    const BX = 24;
    const BW = 744; // 792 - 48
    const TOP_Y = 592;
    const MIN_BOTTOM_Y = 22;
    const BLACK = rgb(0, 0, 0);

    // Pad to minimum 8 rows just like InventarioDocumental.jsx
    const cleanRows = Array.isArray(filas) ? filas.map((r, i) => ({
        n: r.n ?? (i + 1),
        cod: r.cod ?? r.codigo_trd ?? '',
        nombre: r.nombre ?? r.titulo ?? '',
        ini: r.ini ?? '',
        fin: r.fin ?? '',
        caja: r.caja ?? '',
        carp: r.carp ?? '',
        tomo: r.tomo ?? '',
        otro: r.otro ?? '',
        del: r.del ?? '',
        al: r.al ?? '',
        sop: r.sop ?? r.soporte ?? '',
        frec: r.frec ?? 'ALTA',
        notas: r.notas ?? ''
    })) : [];

    while (cleanRows.length < 8) {
        cleanRows.push({
            n: cleanRows.length + 1,
            cod: '', nombre: '', ini: '', fin: '',
            caja: '', carp: '', tomo: '', otro: '',
            del: '', al: '', sop: '', frec: '', notas: ''
        });
    }

    // Exact 14 columns of Tabla 3 summing to 744pt
    const COLS = [
        { key: 'n',      w: 28,  align: 'center', maxLines: 1 },
        { key: 'cod',    w: 54,  align: 'center', maxLines: 2 },
        { key: 'nombre', w: 188, align: 'left',   maxLines: 12 },
        { key: 'ini',    w: 46,  align: 'center', maxLines: 1 },
        { key: 'fin',    w: 46,  align: 'center', maxLines: 1 },
        { key: 'caja',   w: 26,  align: 'center', maxLines: 1 },
        { key: 'carp',   w: 35,  align: 'center', maxLines: 1 },
        { key: 'tomo',   w: 25,  align: 'center', maxLines: 1 },
        { key: 'otro',   w: 25,  align: 'center', maxLines: 1 },
        { key: 'del',    w: 25,  align: 'center', maxLines: 1 },
        { key: 'al',     w: 28,  align: 'center', maxLines: 1 },
        { key: 'sop',    w: 58,  align: 'center', maxLines: 2 },
        { key: 'frec',   w: 58,  align: 'center', maxLines: 1 },
        { key: 'notas',  w: 102, align: 'left',   maxLines: 5 }
    ];

    const pageEntries = []; // { page, hojaCell: { x, topY, w, h }, bottomY }

    const drawGdF004PageHeader = (page) => {
        let y = TOP_Y;

        // ── TABLA 1: ENCABEZADO INSTITUCIONAL (85% | 15%) ──
        const wLeft = 632.4;
        const wRight = 111.6;
        drawBlackBoxCell(page, BX, y, wLeft, 44, { font: fontReg });
        // Draw official green SENA logo centered in left cell
        const logoH = 35;
        const logoW = 35.5;
        page.drawImage(senaLogo, {
            x: BX + (wLeft - logoW) / 2,
            y: y - 44 + (44 - logoH) / 2,
            width: logoW,
            height: logoH
        });

        drawBlackBoxCell(page, BX + wLeft, y, wRight, 20, {
            text: 'Versión: 06', font: fontReg, fontSize: 8.5, align: 'left', padX: 5
        });
        drawBlackBoxCell(page, BX + wLeft, y - 20, wRight, 24, {
            lines: ['Código:', 'GD-F-004'], font: fontReg, fontSize: 8.5, align: 'left', padX: 5, lineHeight: 10
        });
        y -= 44;

        drawBlackBoxCell(page, BX, y, BW, 15, {
            text: 'Proceso Gestión Documental', font: fontBold, fontSize: 9.5, align: 'center'
        });
        y -= 15;

        drawBlackBoxCell(page, BX, y, BW, 15, {
            text: 'Formato Único de Inventario Documental', font: fontBold, fontSize: 9.5, align: 'center'
        });
        y -= 15;

        // ── TABLA 2: DATOS DE CABECERA (16% | 37% | 8% | 10% | 10% | 19%) ──
        const c0 = 119.04, c1 = 275.28, c2 = 59.52, c3 = 74.40, c4 = 74.40, c5 = 141.36;
        const x0 = BX;
        const x1 = x0 + c0;
        const x2 = x1 + c1;
        const x3 = x2 + c2;
        const x4 = x3 + c3;
        const x5 = x4 + c4;

        // Row 1 (h = 17)
        drawBlackBoxCell(page, x0, y, c0, 17, { text: 'SEDE', font: fontBold, fontSize: 8, padX: 4 });
        drawBlackBoxCell(page, x1, y, c1, 17, { text: header.sede || '', font: fontReg, fontSize: 8, padX: 4, maxLines: 1 });
        drawBlackBoxCell(page, x2, y, c2 + c3 + c4, 17, { text: 'REGISTRO DE ENTRADA', font: fontBold, fontSize: 7.5, align: 'center' });
        drawBlackBoxCell(page, x5, y, c5, 17, {
            lines: ['NUT - NÚMERO ÚNICO DE', 'TRANSFERENCIA'], font: fontBold, fontSize: 6.7, align: 'center', lineHeight: 7.5
        });
        y -= 17;

        // Row 2 (h = 15) + NUT rowSpan=2 (h = 40)
        drawBlackBoxCell(page, x0, y, c0, 15, { text: 'UNIDAD ADMINISTRATIVA', font: fontBold, fontSize: 7.5, padX: 4 });
        drawBlackBoxCell(page, x1, y, c1, 15, { text: header.unidad_administrativa || '', font: fontReg, fontSize: 7.6, padX: 4, maxLines: 1 });
        drawBlackBoxCell(page, x2, y, c2, 15, { text: 'AÑO', font: fontReg, fontSize: 7.5, align: 'center' });
        drawBlackBoxCell(page, x3, y, c3, 15, { text: 'MES', font: fontReg, fontSize: 7.5, align: 'center' });
        drawBlackBoxCell(page, x4, y, c4, 15, { text: 'DIA', font: fontReg, fontSize: 7.5, align: 'center' });
        drawBlackBoxCell(page, x5, y, c5, 40, { text: header.nut || '', font: fontReg, fontSize: 8.5, align: 'center', maxLines: 2 });
        y -= 15;

        // Row 3 (h = 25)
        drawBlackBoxCell(page, x0, y, c0, 25, { text: 'OFICINA PRODUCTORA', font: fontBold, fontSize: 7.5, padX: 4 });
        drawBlackBoxCell(page, x1, y, c1, 25, { text: header.oficina_productora || '', font: fontReg, fontSize: 6.5, padX: 4, maxLines: 3, lineHeight: 7.4 });
        drawBlackBoxCell(page, x2, y, c2, 25, { text: header.reg_anio || '', font: fontReg, fontSize: 8, align: 'center' });
        drawBlackBoxCell(page, x3, y, c3, 25, { text: header.reg_mes || '', font: fontReg, fontSize: 8, align: 'center' });
        drawBlackBoxCell(page, x4, y, c4, 25, { text: header.reg_dia || '', font: fontReg, fontSize: 8, align: 'center' });
        y -= 25;

        // Row 4 (h = 16): OBJETO + Hoja X de Y
        drawBlackBoxCell(page, x0, y, c0, 16, { text: 'OBJETO:', font: fontBold, fontSize: 8, padX: 4 });
        drawBlackBoxCell(page, x1, y, c1 + c2 + c3 + c4, 16, { text: header.objeto || '', font: fontReg, fontSize: 8, padX: 4, maxLines: 1 });
        drawBlackBoxCell(page, x5, y, c5, 16, { font: fontBold });
        const hojaCell = { x: x5, topY: y, w: c5, h: 16 };
        y -= 16;

        // ── TABLA 3: ENCABEZADO DE 14 COLUMNAS (h1=16, h2=13 -> total 29) ──
        const h1 = 16, h2 = 13, hTot = 29;
        let cx = BX;
        // 1. No. ITEM (w=28)
        drawBlackBoxCell(page, cx, y, 28, hTot, { lines: ['No.', 'ITEM'], font: fontBold, fontSize: 6.8, align: 'center', lineHeight: 8 });
        cx += 28;
        // 2. CÓDIGO (w=54)
        drawBlackBoxCell(page, cx, y, 54, hTot, { text: 'CÓDIGO', font: fontBold, fontSize: 6.8, align: 'center' });
        cx += 54;
        // 3. NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS (w=188)
        drawBlackBoxCell(page, cx, y, 188, hTot, {
            text: 'NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS', font: fontBold, fontSize: 6.8, align: 'center', maxLines: 2
        });
        cx += 188;
        // 4-5. FECHAS EXTREMAS (w=92 -> 46 + 46)
        drawBlackBoxCell(page, cx, y, 92, h1, { text: 'FECHAS EXTREMAS', font: fontBold, fontSize: 6.6, align: 'center' });
        drawBlackBoxCell(page, cx, y - h1, 46, h2, { text: 'INICIAL', font: fontBold, fontSize: 6.3, align: 'center' });
        drawBlackBoxCell(page, cx + 46, y - h1, 46, h2, { text: 'FINAL', font: fontBold, fontSize: 6.3, align: 'center' });
        cx += 92;
        // 6-9. UNIDAD DE CONSERVACIÓN (w=111 -> 26 + 35 + 25 + 25)
        drawBlackBoxCell(page, cx, y, 111, h1, { text: 'UNIDAD DE CONSERVACIÓN', font: fontBold, fontSize: 6.4, align: 'center' });
        drawBlackBoxCell(page, cx, y - h1, 26, h2, { text: 'CAJA', font: fontBold, fontSize: 6.1, align: 'center', padX: 1 });
        drawBlackBoxCell(page, cx + 26, y - h1, 35, h2, { text: 'CARPETA', font: fontBold, fontSize: 5.9, align: 'center', padX: 1 });
        drawBlackBoxCell(page, cx + 61, y - h1, 25, h2, { text: 'TOMO', font: fontBold, fontSize: 6.0, align: 'center', padX: 1 });
        drawBlackBoxCell(page, cx + 86, y - h1, 25, h2, { text: 'OTRO', font: fontBold, fontSize: 6.0, align: 'center', padX: 1 });
        cx += 111;
        // 10-11. FOLIOS (w=53 -> 25 + 28)
        drawBlackBoxCell(page, cx, y, 53, h1, { text: 'FOLIOS', font: fontBold, fontSize: 6.6, align: 'center' });
        drawBlackBoxCell(page, cx, y - h1, 25, h2, { text: 'DEL', font: fontBold, fontSize: 6.2, align: 'center', padX: 1 });
        drawBlackBoxCell(page, cx + 25, y - h1, 28, h2, { text: 'AL', font: fontBold, fontSize: 6.2, align: 'center', padX: 1 });
        cx += 53;
        // 12. SOPORTE (w=58)
        drawBlackBoxCell(page, cx, y, 58, hTot, { text: 'SOPORTE', font: fontBold, fontSize: 6.8, align: 'center' });
        cx += 58;
        // 13. FRECUENCIA DE CONSULTA (w=58)
        drawBlackBoxCell(page, cx, y, 58, hTot, { lines: ['FRECUENCIA', 'DE CONSULTA'], font: fontBold, fontSize: 6.2, align: 'center', lineHeight: 8 });
        cx += 58;
        // 14. NOTAS (w=102)
        drawBlackBoxCell(page, cx, y, 102, hTot, { text: 'NOTAS', font: fontBold, fontSize: 6.8, align: 'center' });

        y -= hTot;
        return { y, hojaCell };
    };

    const openNewPage = () => {
        const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
        const { y, hojaCell } = drawGdF004PageHeader(p);
        const entry = { page: p, hojaCell, bottomY: y };
        pageEntries.push(entry);
        return entry;
    };

    let curEntry = openNewPage();
    let y = curEntry.bottomY;
    const ROW_FONT_SIZE = 7.0;
    const ROW_LINE_H = 8.4;
    const SIG_TOTAL_H = 94;
    let rowsOnCurPage = 0;

    for (let i = 0; i < cleanRows.length; i++) {
        const r = cleanRows[i];
        const cellLines = COLS.map((col) => {
            const val = r[col.key] !== undefined && r[col.key] !== null ? String(r[col.key]) : '';
            return wrapPdfText(val, fontReg, ROW_FONT_SIZE, col.w - 4, col.maxLines);
        });
        const maxLn = Math.max(...cellLines.map(arr => arr.filter(Boolean).length || 1), 1);
        const rowH = Math.max(15, maxLn * ROW_LINE_H + 5);

        const isLastDataRow = i === cleanRows.length - 1;
        const requiredFloor = isLastDataRow ? (MIN_BOTTOM_Y + SIG_TOTAL_H) : MIN_BOTTOM_Y;

        if (rowsOnCurPage > 0 && (y - rowH < requiredFloor)) {
            curEntry.bottomY = y;
            curEntry = openNewPage();
            y = curEntry.bottomY;
            rowsOnCurPage = 0;
        }

        let cx = BX;
        for (let c = 0; c < COLS.length; c++) {
            const col = COLS[c];
            drawBlackBoxCell(curEntry.page, cx, y, col.w, rowH, {
                lines: cellLines[c],
                font: fontReg,
                fontSize: ROW_FONT_SIZE,
                align: col.align,
                padX: 2.5,
                lineHeight: ROW_LINE_H
            });
            cx += col.w;
        }
        y -= rowH;
        rowsOnCurPage += 1;
        curEntry.bottomY = y;
    }

    // Pad last page to at least 6 rows if it has fewer so Tabla 4 never looks cramped
    while (rowsOnCurPage < 6 && (y - 15 >= MIN_BOTTOM_Y + SIG_TOTAL_H)) {
        let cx = BX;
        for (let c = 0; c < COLS.length; c++) {
            drawBlackBoxCell(curEntry.page, cx, y, COLS[c].w, 15, { text: '', font: fontReg, fontSize: ROW_FONT_SIZE });
            cx += COLS[c].w;
        }
        y -= 15;
        rowsOnCurPage += 1;
        curEntry.bottomY = y;
    }

    // ── TABLA 4: FIRMAS OFICIALES (19% | 27% | 27% | 27%) — total height = 94pt ──
    if (y - SIG_TOTAL_H < MIN_BOTTOM_Y) {
        curEntry.bottomY = y;
        curEntry = openNewPage();
        y = curEntry.bottomY;
    }

    const s0 = 141.36, s1 = 200.88, s2 = 200.88, s3 = 200.88;
    const sx0 = BX, sx1 = sx0 + s0, sx2 = sx1 + s1, sx3 = sx2 + s2;

    // Row 1 (h = 14)
    drawBlackBoxCell(curEntry.page, sx0, y, s0, 14, { text: '', font: fontBold, fontSize: 7.8 });
    drawBlackBoxCell(curEntry.page, sx1, y, s1, 14, { text: 'ELABORADO POR', font: fontBold, fontSize: 7.8, align: 'center' });
    drawBlackBoxCell(curEntry.page, sx2, y, s2, 14, { text: 'ENTREGADO POR', font: fontBold, fontSize: 7.8, align: 'center' });
    drawBlackBoxCell(curEntry.page, sx3, y, s3, 14, { text: 'RECIBIDO POR', font: fontBold, fontSize: 7.8, align: 'center' });
    y -= 14;

    // Row 2: NOMBRES Y APELLIDOS (h = 16)
    drawBlackBoxCell(curEntry.page, sx0, y, s0, 16, { text: 'NOMBRES Y APELLIDOS', font: fontBold, fontSize: 7.4, align: 'center' });
    drawBlackBoxCell(curEntry.page, sx1, y, s1, 16, { text: signatures.elaborado_nombre || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx2, y, s2, 16, { text: signatures.entregado_nombre || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx3, y, s3, 16, { text: signatures.recibido_nombre || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    y -= 16;

    // Row 3: CARGO (h = 16)
    drawBlackBoxCell(curEntry.page, sx0, y, s0, 16, { text: 'CARGO', font: fontBold, fontSize: 7.4, align: 'center' });
    drawBlackBoxCell(curEntry.page, sx1, y, s1, 16, { text: signatures.elaborado_cargo || '', font: fontReg, fontSize: 7.2, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx2, y, s2, 16, { text: signatures.entregado_cargo || '', font: fontReg, fontSize: 7.2, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx3, y, s3, 16, { text: signatures.recibido_cargo || '', font: fontReg, fontSize: 7.2, align: 'center', maxLines: 1 });
    y -= 16;

    // Row 4: FIRMA (h = 32)
    drawBlackBoxCell(curEntry.page, sx0, y, s0, 32, { text: 'FIRMA', font: fontBold, fontSize: 7.4, align: 'center', valign: 'top', padTop: 5 });
    drawBlackBoxCell(curEntry.page, sx1, y, s1, 32, { text: '', font: fontReg });
    drawBlackBoxCell(curEntry.page, sx2, y, s2, 32, { text: '', font: fontReg });
    drawBlackBoxCell(curEntry.page, sx3, y, s3, 32, { text: '', font: fontReg });
    y -= 32;

    // Row 5: FECHA (h = 16)
    drawBlackBoxCell(curEntry.page, sx0, y, s0, 16, { text: 'FECHA', font: fontBold, fontSize: 7.4, align: 'center' });
    drawBlackBoxCell(curEntry.page, sx1, y, s1, 16, { text: signatures.elaborado_fecha || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx2, y, s2, 16, { text: signatures.entregado_fecha || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    drawBlackBoxCell(curEntry.page, sx3, y, s3, 16, { text: signatures.recibido_fecha || '', font: fontReg, fontSize: 7.4, align: 'center', maxLines: 1 });
    y -= 16;
    curEntry.bottomY = y;

    // Stamp outer 1.5pt black border (.inv-box) and "Hoja _X_ de _Y_" on every page
    const totalPages = pageEntries.length;
    pageEntries.forEach((entry, idx) => {
        const p = entry.page;
        const boxH = TOP_Y - entry.bottomY;
        p.drawRectangle({
            x: BX,
            y: entry.bottomY,
            width: BW,
            height: boxH,
            borderColor: BLACK,
            borderWidth: 1.4
        });

        // Exact "Hoja  _X_  de  _Y_" with underlined inline spans matching InventarioDocumental.jsx
        const hc = entry.hojaCell;
        const pStr = String(idx + 1);
        const totStr = String(totalPages);
        const fs = 8.5;
        const baseY = hc.topY - hc.h + 5;
        const wHoja = fontBold.widthOfTextAtSize('Hoja ', fs);
        const wDe = fontBold.widthOfTextAtSize(' de ', fs);
        const boxNumW = Math.max(16, fontBold.widthOfTextAtSize(totStr, fs) + 8);
        const totalW = wHoja + boxNumW + wDe + boxNumW;
        let curX = hc.x + hc.w - 12 - totalW;

        p.drawText('Hoja ', { x: curX, y: baseY, size: fs, font: fontBold, color: BLACK });
        curX += wHoja;
        const pTw = fontBold.widthOfTextAtSize(pStr, fs);
        p.drawText(pStr, { x: curX + (boxNumW - pTw) / 2, y: baseY, size: fs, font: fontBold, color: BLACK });
        p.drawLine({ start: { x: curX, y: baseY - 1.5 }, end: { x: curX + boxNumW, y: baseY - 1.5 }, thickness: 0.75, color: BLACK });
        curX += boxNumW;

        p.drawText(' de ', { x: curX, y: baseY, size: fs, font: fontBold, color: BLACK });
        curX += wDe;
        const tTw = fontBold.widthOfTextAtSize(totStr, fs);
        p.drawText(totStr, { x: curX + (boxNumW - tTw) / 2, y: baseY, size: fs, font: fontBold, color: BLACK });
        p.drawLine({ start: { x: curX, y: baseY - 1.5 }, end: { x: curX + boxNumW, y: baseY - 1.5 }, thickness: 0.75, color: BLACK });
    });

    return pdfDoc.save();
};

// ============================================================================
// RENDERIZADOR OFICIAL SENA 2: GD-F-003 Versión: 04 (Vertical Tamaño Carta)
// Hoja de Control por Expediente — 100% idéntico a HojaControl.jsx
// ============================================================================
const renderOfficialGdF003Pdf = async ({ groups = [], fallbackHeader = {}, fallbackResponsable = '' }) => {
    const pdfDoc = await PDFDocument.create();
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const senaLogo = await pdfDoc.embedPng(Buffer.from(SENA_LOGO_PNG_B64, 'base64'));

    const PAGE_W = 612; // Letter Portrait
    const PAGE_H = 792;
    const BX = 28;
    const BW = 556; // 612 - 56
    const TOP_Y = 764;
    const MIN_BOTTOM_Y = 28;
    const BLACK = rgb(0, 0, 0);

    // 13% | 37% | 8% | 8% | 10% | 24% of 556pt
    const CW = [72.28, 205.72, 44.48, 44.48, 55.60, 133.44];
    const CX = [BX];
    for (let i = 0; i < CW.length; i++) CX.push(CX[i] + CW[i]);

    const effectiveGroups = groups.length > 0 ? groups : [{
        sede: fallbackHeader.sede || 'REGIONAL SANTANDER',
        cod_sede: fallbackHeader.cod_sede || '68',
        unidad_administrativa: fallbackHeader.unidad_administrativa || 'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL',
        cod_unidad: fallbackHeader.cod_unidad || '68.9224',
        oficina_productora: fallbackHeader.oficina_productora || '',
        cod_oficina: fallbackHeader.cod_oficina || '68.9224',
        series_name: '',
        series_code: '',
        subseries_name: '',
        subseries_code: '',
        identificacion_expediente: '',
        responsable: fallbackResponsable || '',
        documentos: []
    }];

    for (const grp of effectiveGroups) {
        const docs = Array.isArray(grp.documentos) ? [...grp.documentos] : [];
        while (docs.length < 15) {
            docs.push({ fecha: '', tipo: '', fisico: '', electronico: '', folios: '', obs: '' });
        }

        const grpPages = [];

        const drawGdF003Header = (page) => {
            let y = TOP_Y;
            const wLogo = CW[0] + CW[1] + CW[2] + CW[3];
            const wCode = CW[4] + CW[5];

            drawBlackBoxCell(page, CX[0], y, wLogo, 44, { font: fontReg });
            page.drawImage(senaLogo, {
                x: CX[0] + (wLogo - 35.5) / 2,
                y: y - 44 + 4.5,
                width: 35.5,
                height: 35
            });
            drawBlackBoxCell(page, CX[4], y, wCode, 20, { text: 'Versión: 04', font: fontReg, fontSize: 8.5, padX: 5 });
            drawBlackBoxCell(page, CX[4], y - 20, wCode, 24, { lines: ['Código:', 'GD-F-003'], font: fontReg, fontSize: 8.5, padX: 5, lineHeight: 10 });
            y -= 44;

            drawBlackBoxCell(page, BX, y, BW, 15, { text: 'PROCESO GESTIÓN DOCUMENTAL', font: fontBold, fontSize: 9, align: 'center' });
            y -= 15;
            drawBlackBoxCell(page, BX, y, BW, 15, { text: 'HOJA DE CONTROL', font: fontBold, fontSize: 9, align: 'center' });
            y -= 15;

            const metaRows = [
                ['SEDE', grp.sede || '', 'CÓDIGO', grp.cod_sede || '', 16],
                ['UNIDAD ADMINISTRATIVA', grp.unidad_administrativa || '', 'CÓDIGO', grp.cod_unidad || '', 16],
                ['OFICINA PRODUCTORA', grp.oficina_productora || '', 'CÓDIGO', grp.cod_oficina || '', 22],
                ['SERIE DOCUMENTAL', grp.series_name || '', 'CÓDIGO', grp.series_code || '', 16],
                ['SUBSERIE', grp.subseries_name || '', 'CÓDIGO', grp.subseries_code || '', 16]
            ];

            for (const [lbl, val, codLbl, codVal, rh] of metaRows) {
                drawBlackBoxCell(page, CX[0], y, CW[0], rh, { text: lbl, font: fontBold, fontSize: 6.8, padX: 3, maxLines: 2 });
                drawBlackBoxCell(page, CX[1], y, CW[1], rh, { text: val, font: fontReg, fontSize: 6.8, padX: 3, maxLines: 2 });
                drawBlackBoxCell(page, CX[2], y, CW[2] + CW[3], rh, { text: codLbl, font: fontBold, fontSize: 7, align: 'center' });
                drawBlackBoxCell(page, CX[4], y, CW[4] + CW[5], rh, { text: codVal, font: fontReg, fontSize: 7.2, align: 'center' });
                y -= rh;
            }

            // IDENTIFICACIÓN DEL EXPEDIENTE (alto dinámico para mostrar el campo completo sin truncar)
            const identW = CW[1] + CW[2] + CW[3] + CW[4] + CW[5];
            const identLines = wrapPdfText(grp.identificacion_expediente || '', fontBold, 7.2, identW - 8, 6);
            const identH = Math.max(24, (identLines.filter(Boolean).length || 1) * 8.6 + 6);
            drawBlackBoxCell(page, CX[0], y, CW[0], identH, { lines: ['IDENTIFICACIÓN DEL', 'EXPEDIENTE'], font: fontBold, fontSize: 6.5, padX: 3, lineHeight: 8 });
            drawBlackBoxCell(page, CX[1], y, identW, identH, {
                lines: identLines, font: fontBold, fontSize: 7.2, padX: 4, lineHeight: 8.6
            });
            y -= identH;

            // Grid header (h1 = 16, h2 = 14 -> 30)
            const h1 = 16, h2 = 14, hTot = 30;
            drawBlackBoxCell(page, CX[0], y, CW[0], hTot, { lines: ['FECHA DE', 'INGRESO', 'AAAA/MM/DD'], font: fontBold, fontSize: 6.3, align: 'center', lineHeight: 7.5 });
            drawBlackBoxCell(page, CX[1], y, CW[1], hTot, { text: 'IDENTIFICACIÓN DEL TIPO DOCUMENTAL', font: fontBold, fontSize: 7, align: 'center', maxLines: 2 });
            drawBlackBoxCell(page, CX[2], y, CW[2] + CW[3], h1, { text: 'SOPORTE', font: fontBold, fontSize: 7, align: 'center' });
            drawBlackBoxCell(page, CX[2], y - h1, CW[2], h2, { text: 'FÍSICO', font: fontBold, fontSize: 6.2, align: 'center' });
            drawBlackBoxCell(page, CX[3], y - h1, CW[3], h2, { text: 'ELECTRÓNICO', font: fontBold, fontSize: 5.8, align: 'center', padX: 1 });
            drawBlackBoxCell(page, CX[4], y, CW[4], hTot, { lines: ['No. DE', 'FOLIOS', 'DEL - AL'], font: fontBold, fontSize: 6.3, align: 'center', lineHeight: 7.5 });
            drawBlackBoxCell(page, CX[5], y, CW[5], hTot, { text: 'OBSERVACIONES', font: fontBold, fontSize: 7, align: 'center' });
            y -= hTot;

            return y;
        };

        const openGrpPage = () => {
            const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
            const startY = drawGdF003Header(p);
            const entry = { page: p, bottomY: startY, footerTopY: null };
            grpPages.push(entry);
            return entry;
        };

        let cur = openGrpPage();
        let y = cur.bottomY;
        const FOOTER_H = 34;

        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            const tipoLines = wrapPdfText(doc.tipo || '', fontReg, 7.0, CW[1] - 6, 3);
            const obsLines = wrapPdfText(doc.obs || '', fontReg, 6.8, CW[5] - 6, 2);
            const maxLn = Math.max(tipoLines.filter(Boolean).length || 1, obsLines.filter(Boolean).length || 1, 1);
            const rowH = Math.max(16, maxLn * 8.4 + 5);

            const isLastRow = i === docs.length - 1;
            const minNeeded = isLastRow ? (MIN_BOTTOM_Y + FOOTER_H) : MIN_BOTTOM_Y;
            if (y - rowH < minNeeded) {
                cur.bottomY = y;
                cur = openGrpPage();
                y = cur.bottomY;
            }

            drawBlackBoxCell(cur.page, CX[0], y, CW[0], rowH, { text: doc.fecha || '', font: fontReg, fontSize: 7.0, align: 'center', maxLines: 1 });
            drawBlackBoxCell(cur.page, CX[1], y, CW[1], rowH, { lines: tipoLines, font: fontReg, fontSize: 7.0, align: 'left', padX: 3, lineHeight: 8.4 });
            drawBlackBoxCell(cur.page, CX[2], y, CW[2], rowH, { text: doc.fisico || '', font: fontReg, fontSize: 7.5, align: 'center', maxLines: 1 });
            drawBlackBoxCell(cur.page, CX[3], y, CW[3], rowH, { text: doc.electronico || '', font: fontReg, fontSize: 7.5, align: 'center', maxLines: 1 });
            drawBlackBoxCell(cur.page, CX[4], y, CW[4], rowH, { text: doc.folios || '', font: fontReg, fontSize: 7.0, align: 'center', maxLines: 1 });
            drawBlackBoxCell(cur.page, CX[5], y, CW[5], rowH, { lines: obsLines, font: fontReg, fontSize: 6.8, align: 'left', padX: 3, lineHeight: 8.2 });

            y -= rowH;
            cur.bottomY = y;
        }

        // Footer row on each page of this expediente (matching HojaControl.jsx lines 562-570)
        const totalGrpPages = grpPages.length;
        grpPages.forEach((entry, pIdx) => {
            const p = entry.page;
            let fy = entry.bottomY;
            if (fy - FOOTER_H < 14) fy = 14 + FOOTER_H;

            drawBlackBoxCell(p, BX, fy, BW, FOOTER_H, { font: fontReg });
            p.drawText('NOMBRES Y APELLIDOS DEL RESPONSABLE DE ARCHIVAR LA INFORMACIÓN:', {
                x: BX + 4,
                y: fy - 11,
                size: 7.2,
                font: fontBold,
                color: BLACK
            });
            const respClean = sanitizeWinAnsi(grp.responsable || fallbackResponsable || '');
            if (respClean) {
                p.drawText(respClean, {
                    x: BX + 4,
                    y: fy - 24,
                    size: 8.5,
                    font: fontReg,
                    color: BLACK
                });
            }
            const pgStr = `PÁGINA ${pIdx + 1} DE ${totalGrpPages}`;
            const pgW = fontReg.widthOfTextAtSize(pgStr, 8);
            p.drawText(pgStr, {
                x: CX[5] + (CW[5] - pgW) / 2,
                y: fy - FOOTER_H + 8,
                size: 8,
                font: fontReg,
                color: BLACK
            });

            const finalBottom = fy - FOOTER_H;
            p.drawRectangle({
                x: BX,
                y: finalBottom,
                width: BW,
                height: TOP_Y - finalBottom,
                borderColor: BLACK,
                borderWidth: 1.2
            });
        });
    }

    return pdfDoc.save();
};

// GET /inventory-users - Users list with uploaded document & expediente counts
router.get('/inventory-users', requireAuth, async (req, res) => {
    try {
        const { pool: pgPool } = require('../database_pg');
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

        if (!isAdmin) {
            const own = await pgPool.query(
                `SELECT u.id, u.full_name, u.document_no, u.area, u.position, u.role,
                        (SELECT COUNT(*)::int FROM documents d
                         WHERE d.user_id = u.id
                            OR (d.expediente_id IS NOT NULL AND EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = d.expediente_id AND ea.user_id = u.id))
                        ) AS docs_uploaded,
                        (SELECT COUNT(DISTINCT d.expediente_id)::int FROM documents d
                         WHERE d.expediente_id IS NOT NULL
                           AND (d.user_id = u.id OR EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = d.expediente_id AND ea.user_id = u.id))
                        ) AS expedientes_uploaded,
                        (SELECT COUNT(DISTINCT ea.expediente_id)::int FROM expediente_assignments ea WHERE ea.user_id = u.id) AS assigned_expedientes,
                        (SELECT COUNT(DISTINCT ea.expediente_id)::int FROM expediente_assignments ea
                         WHERE ea.user_id = u.id AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = ea.expediente_id)
                        ) AS assigned_sin_docs
                 FROM users u WHERE u.id = $1 LIMIT 1`,
                [req.user.id]
            );
            return res.json({ isAdmin: false, data: own.rows });
        }

        const allRes = await pgPool.query(`
            SELECT
                u.id,
                u.full_name,
                u.document_no,
                u.area,
                u.position,
                u.role,
                u.is_active,
                (SELECT COUNT(*)::int FROM documents d
                 WHERE d.user_id = u.id
                    OR (d.expediente_id IS NOT NULL AND EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = d.expediente_id AND ea.user_id = u.id))
                ) AS docs_uploaded,
                (SELECT COUNT(DISTINCT d.expediente_id)::int FROM documents d
                 WHERE d.expediente_id IS NOT NULL
                   AND (d.user_id = u.id OR EXISTS (SELECT 1 FROM expediente_assignments ea WHERE ea.expediente_id = d.expediente_id AND ea.user_id = u.id))
                ) AS expedientes_uploaded,
                (SELECT COUNT(DISTINCT ea.expediente_id)::int FROM expediente_assignments ea WHERE ea.user_id = u.id) AS assigned_expedientes,
                (SELECT COUNT(DISTINCT ea.expediente_id)::int FROM expediente_assignments ea
                 WHERE ea.user_id = u.id AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.expediente_id = ea.expediente_id)
                ) AS assigned_sin_docs
            FROM users u
            ORDER BY docs_uploaded DESC, u.full_name ASC
        `);
        res.json({ isAdmin: true, data: allRes.rows });
    } catch (err) {
        console.error('[GET /inventory-users] Error:', err);
        res.status(500).json({ error: err.message || 'Error consultando usuarios del inventario.' });
    }
});

// GET /inventory-preview - Live preview & FUID table loader for InventarioDocumental.jsx and InventoryPdfModal.jsx
router.get('/inventory-preview', requireAuth, async (req, res) => {
    try {
        const reqLimit = Math.min(Math.max(parseInt(req.query.limit || '60', 10) || 60, 10), 5000);
        const dataset = await buildInventoryDataset(req, 25);
        const isHojaControl = dataset.mode === 'hoja_control';

        res.json({
            mode: dataset.mode,
            user: dataset.targetUser,
            headerDefaults: dataset.headerDefaults,
            signatureDefaults: dataset.signatureDefaults,
            kpis: dataset.kpis,
            subseries: dataset.subseriesList,
            total_rows: isHojaControl ? dataset.hojaControlGroups.length : dataset.fuidRows.length,
            rows: dataset.fuidRows.slice(0, reqLimit),
            hojaControlGroups: dataset.hojaControlGroups.slice(0, Math.min(reqLimit, 50))
        });
    } catch (err) {
        console.error('[GET /inventory-preview] Error:', err);
        res.status(500).json({ error: err.message || 'Error generando vista previa del inventario.' });
    }
});

// GET /inventory-pdf - Official SENA GD-F-004 Versión: 06 (FUID) or GD-F-003 Versión: 04 (Hoja de Control)
router.get('/inventory-pdf', requireAuth, async (req, res) => {
    try {
        const dataset = await buildInventoryDataset(req, 600);
        const q = req.query || {};

        const mergedHeader = {
            sede: q.sede !== undefined ? q.sede : dataset.headerDefaults.sede,
            cod_sede: q.cod_sede !== undefined ? q.cod_sede : dataset.headerDefaults.cod_sede,
            unidad_administrativa: q.unidad_administrativa !== undefined ? q.unidad_administrativa : dataset.headerDefaults.unidad_administrativa,
            cod_unidad: q.cod_unidad !== undefined ? q.cod_unidad : dataset.headerDefaults.cod_unidad,
            oficina_productora: q.oficina_productora !== undefined ? q.oficina_productora : dataset.headerDefaults.oficina_productora,
            cod_oficina: q.cod_oficina !== undefined ? q.cod_oficina : dataset.headerDefaults.cod_oficina,
            reg_anio: q.reg_anio !== undefined ? q.reg_anio : dataset.headerDefaults.reg_anio,
            reg_mes: q.reg_mes !== undefined ? q.reg_mes : dataset.headerDefaults.reg_mes,
            reg_dia: q.reg_dia !== undefined ? q.reg_dia : dataset.headerDefaults.reg_dia,
            nut: q.nut !== undefined ? q.nut : dataset.headerDefaults.nut,
            objeto: q.objeto !== undefined ? q.objeto : dataset.headerDefaults.objeto
        };

        const mergedSignatures = {
            elaborado_nombre: q.elaborado_nombre !== undefined ? q.elaborado_nombre : dataset.signatureDefaults.elaborado_nombre,
            elaborado_cargo: q.elaborado_cargo !== undefined ? q.elaborado_cargo : dataset.signatureDefaults.elaborado_cargo,
            elaborado_fecha: q.elaborado_fecha !== undefined ? q.elaborado_fecha : dataset.signatureDefaults.elaborado_fecha,
            entregado_nombre: q.entregado_nombre !== undefined ? q.entregado_nombre : dataset.signatureDefaults.entregado_nombre,
            entregado_cargo: q.entregado_cargo !== undefined ? q.entregado_cargo : dataset.signatureDefaults.entregado_cargo,
            entregado_fecha: q.entregado_fecha !== undefined ? q.entregado_fecha : dataset.signatureDefaults.entregado_fecha,
            recibido_nombre: q.recibido_nombre !== undefined ? q.recibido_nombre : dataset.signatureDefaults.recibido_nombre,
            recibido_cargo: q.recibido_cargo !== undefined ? q.recibido_cargo : dataset.signatureDefaults.recibido_cargo,
            recibido_fecha: q.recibido_fecha !== undefined ? q.recibido_fecha : dataset.signatureDefaults.recibido_fecha
        };

        let pdfBytes;
        let formatCodeSlug = 'GD_F_004_FUID';

        if (dataset.mode === 'hoja_control') {
            formatCodeSlug = 'GD_F_003_Hoja_Control';
            pdfBytes = await renderOfficialGdF003Pdf({
                groups: dataset.hojaControlGroups,
                fallbackHeader: mergedHeader,
                fallbackResponsable: mergedSignatures.elaborado_nombre
            });
        } else {
            pdfBytes = await renderOfficialGdF004Pdf({
                header: mergedHeader,
                signatures: mergedSignatures,
                filas: dataset.fuidRows
            });
        }

        const safeUserSlug = sanitizeWinAnsi(dataset.targetUser.full_name || 'Consolidado')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 36) || 'SENA';
        const dateSlug = new Date().toISOString().slice(0, 10);
        const downloadName = `${formatCodeSlug}_${safeUserSlug}_${dateSlug}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Length', pdfBytes.length);
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        console.error('[GET /inventory-pdf] Error:', err);
        res.status(500).json({ error: err.message || 'Error generando el PDF institucional del inventario.' });
    }
});

// POST /inventory-pdf - Export exact edited GD-F-004 Versión: 06 table directly from InventarioDocumental.jsx
router.post('/inventory-pdf', requireAuth, async (req, res) => {
    try {
        const { header = {}, signatures = {}, filas = [], filename = '' } = req.body || {};
        const pdfBytes = await renderOfficialGdF004Pdf({ header, signatures, filas });
        const safeName = sanitizeWinAnsi(filename || 'GD_F_004_Inventario_Documental_SENA.pdf')
            .replace(/[^a-zA-Z0-9._-]+/g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName.endsWith('.pdf') ? safeName : safeName + '.pdf'}"`);
        res.setHeader('Content-Length', pdfBytes.length);
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        console.error('[POST /inventory-pdf] Error:', err);
        res.status(500).json({ error: err.message || 'Error generando el PDF GD-F-004.' });
    }
});

module.exports = router;
