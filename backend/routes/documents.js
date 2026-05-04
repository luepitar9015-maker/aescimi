const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const db = require('../database');
const sharp = require('sharp');

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
router.post('/upload', upload.single('file'), async (req, res) => {
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
                if (!trdInfo) {
                    return resolve(false);
                }
                const q = `
                    SELECT can_upload FROM user_trd_permissions 
                    WHERE user_id = $1 AND (series_id = $2 OR subseries_id = $3)
                    ORDER BY can_upload DESC LIMIT 1
                `;
                db.get(q, [req.user.id, trdInfo.series_id || null, trdInfo.id || null], (err, row) => {
                    resolve(row ? row.can_upload === 1 : false);
                });
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

        const basePath = (await getSystemSetting('storage_path')) || trdInfo?.storage_path || path.join(__dirname, '../uploads/Gestion_Documental');
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
                else if (type === 'meta_1') value = expediente.title || metaValues['valor1'] || metaValues['Metadato 1'] || '';
                else if (type.startsWith('meta_')) {
                    const idx = type.split('_')[1];
                    value = metaValues[`valor${idx}`] || metaValues[`Metadato ${idx}`] || '';
                }
                
                return String(value || '')
                    .replace(/[.-]/g, '')
                    .replace(/[<>:"/\\|?*]/g, '') 
                    .trim();
            });

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
            pdfDoc = await PDFDocument.load(sourcePdfBytes);
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
                            map[r.typology_name] = idx + 1; // 1-based index
                        });
                    }
                    resolve(map);
                });
            });
        };

        const typologyOrderMap = await getTypologyOrderMap(trdInfo?.series_id, trdInfo?.id);

        // Helper to generate filename: Uses TRD order (e.g. 01_Acta, 02_Informe)
        const generateFilename = (typName, currentDocIndex) => {
            const safeName = typName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
            const trdOrder = typologyOrderMap[typName] || 99; // Fallback a 99 si no está en TRD
            const paddedOrder = String(trdOrder).padStart(2, '0');
            
            // Si hay múltiples documentos de la misma tipología, se agrega un sufijo _2, _3
            if (currentDocIndex > 1) {
                return `${paddedOrder}_${safeName}_${currentDocIndex}.pdf`;
            }
            return `${paddedOrder}_${safeName}.pdf`;
        };

        // Helper to save document to DB
        const saveToDb = (filename, filePath, typologyName) => {
            return new Promise((resolve, reject) => {
                const query = `INSERT INTO documents (
                    organization_id, trd_series_id, trd_subseries_id, expediente_id,
                    filename, path, typology_name, document_date, origen
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                
                // Note: We use IDs from trdInfo if available, and expediente.id
                db.run(query, [
                    trdInfo?.dependency_id || null,
                    trdInfo?.series_id || null,
                    trdInfo?.id || null, // subseries_id
                    expediente.id || null, // Ensure string if storing string, but it's integer column usually
                    filename,
                    filePath,
                    typologyName,
                    documentDate,
                    origen
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
                const filename = generateFilename(typ.name, typologyCounts[typ.name]);
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
                
                // Save record to DB
                await saveToDb(filename, outputPath, typ.name);
                
                results.push({ file: filename, path: outputPath });
            }
        } else {
            // No Split - Save entire document (from pdfDoc to include any conversion)
            const mainTypology = typologies[0] ? typologies[0].name : 'Documento_General';
            
            const { expDir, backupExpDir, pathParts } = await buildPathsForTypology(mainTypology);
            firstExpDir = expDir;
            
            console.log(`[UPLOAD] ✅ Niveles resueltos (${mainTypology}):`, pathParts.join(' > '));
            console.log(`[UPLOAD] ✅ Directorio final (${mainTypology}):`, expDir);
            
            typologyCounts[mainTypology] = (typologyCounts[mainTypology] || 0) + 1;
            const filename = generateFilename(mainTypology, typologyCounts[mainTypology]);
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
            await saveToDb(filename, outputPath, mainTypology);
            
            results.push({ file: filename, path: outputPath });
        }

        // Clean up temp file
        fs.unlinkSync(sourcePath);

        res.json({ success: true, files: results, storage_path: firstExpDir });

    } catch (err) {
        console.error("Error processing document:", err);
        res.status(500).json({ error: err.message });
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
});

// GET / - List all saved documents (most recent first)
router.get('/', (req, res) => {
    const query = `
        SELECT 
            d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.created_at, d.origen,
            d.expediente_id,
            e.title as expediente_title, e.expediente_code, e.subserie,
            sub.subseries_name, ser.series_name,
            org.section_name, org.subsection_name
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
        LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
        LEFT JOIN organization_structure org ON d.organization_id = org.id
        GROUP BY d.id, e.id, sub.id, ser.id, org.id
        ORDER BY d.created_at DESC
        LIMIT 200
    `;
    
    let finalQuery = query;
    let params = [];
    
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
            
            if (perms.length === 0) return res.json({ data: [] });
            
            const seriesIds = perms.map(p => p.series_id).filter(Boolean);
            const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);
            
            // Use ANY with parameterized arrays to prevent SQL injection
            const paramSeriesIds = seriesIds.length > 0 ? seriesIds : [-1];
            const paramSubseriesIds = subseriesIds.length > 0 ? subseriesIds : [-1];
            
            const filteredQuery = `
                SELECT 
                    d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.created_at, d.origen,
                    d.expediente_id,
                    e.title as expediente_title, e.expediente_code, e.subserie,
                    sub.subseries_name, ser.series_name,
                    org.section_name, org.subsection_name
                FROM documents d
                LEFT JOIN expedientes e ON d.expediente_id = e.id
                LEFT JOIN trd_subseries sub ON d.trd_subseries_id = sub.id
                LEFT JOIN trd_series ser ON d.trd_series_id = ser.id
                LEFT JOIN organization_structure org ON d.organization_id = org.id
                WHERE (d.trd_series_id = ANY($1::int[]) OR d.trd_subseries_id = ANY($2::int[]))
                  AND d.organization_id = $3
                GROUP BY d.id, e.id, sub.id, ser.id, org.id
                ORDER BY d.created_at DESC
                LIMIT 200
            `;
            db.all(filteredQuery, [paramSeriesIds, paramSubseriesIds, req.user.organization_id || 0], (err, rows) => {
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
        SELECT d.id, d.filename, d.path, d.typology_name, d.document_date, d.status, d.created_at, d.origen
        FROM documents d
        WHERE d.expediente_id = ?
        ORDER BY d.filename ASC
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// GET /fix-names/:expedienteId - Run the rename script for a specific expediente via API
router.get('/fix-names/:expedienteId', async (req, res) => {
    const searchValue = req.params.expedienteId;
    try {
        const expedienteQuery = `
            SELECT e.*, 
                   sub.id as subseries_id, ser.id as series_id
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
            WHERE e.id::text = $1 OR e.title LIKE $2 OR e.expediente_code LIKE $2
            LIMIT 1
        `;
        const likeParam = `%${searchValue}%`;
        
        // As database_pg uses pg, we use db.query which is exposed correctly if we use it via our adapter or directly.
        // In documents.js, db.all is used for sqlite compat. Let's use db.all for compatibility.
        // Wait, db.all uses ?, not $1.
        const sqliteQuery = `
            SELECT e.*, 
                   sub.id as subseries_id, ser.id as series_id
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series ser ON (e.subserie = ser.series_code OR e.subserie LIKE '%-' || ser.series_code OR sub.series_id = ser.id)
            WHERE e.id = ? OR e.title LIKE ? OR e.expediente_code LIKE ?
            LIMIT 1
        `;
        
        const getExpediente = () => new Promise((resolve, reject) => {
            // we try to parse it as int for e.id, if it's text we just pass 0
            const idVal = isNaN(parseInt(searchValue)) ? 0 : parseInt(searchValue);
            db.get(sqliteQuery, [idVal, likeParam, likeParam], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        
        const expediente = await getExpediente();
        if (!expediente) return res.status(404).json({ error: 'Expediente no encontrado.' });

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
                    rows.forEach((r, idx) => map[r.typology_name] = idx + 1);
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
            const trdOrder = typologyOrderMap[typName] || 99;
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
                if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
            } catch (err) {
                resultsLog.push(`Doc ${doc.id}: Error físico -> ${err.message}`);
                continue;
            }

            await new Promise((resolve) => {
                db.run("UPDATE documents SET filename = ?, path = ? WHERE id = ?", [newFilename, newPath, doc.id], (err) => {
                    if (err) resultsLog.push(`Doc ${doc.id}: Error BD -> ${err.message}`);
                    else resultsLog.push(`Doc ${doc.id}: Renombrado a ${newFilename}`);
                    resolve();
                });
            });
        }
        res.json({ success: true, message: 'Renombrado completado.', logs: resultsLog });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update document details
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { filename, typology_name, document_date, origen, path: newDirectPath } = req.body;

    db.get("SELECT * FROM documents WHERE id = ?", [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Documento no encontrado' });

        const oldPath = doc.path;
        const dir = path.dirname(oldPath);

        // Determine resolved filename and path
        let resolvedFilename = filename || doc.filename;
        let resolvedPath = newDirectPath || oldPath;

        // Only try physical rename if filename is a short safe name (not a joinedName)
        const isSafeName = resolvedFilename && resolvedFilename.length < 120 &&
            !resolvedFilename.includes('/') && !resolvedFilename.includes('\\') &&
            resolvedFilename !== doc.filename;

        const doUpdate = () => {
            const query = `UPDATE documents SET filename = ?, path = ?, typology_name = ?, document_date = ?, origen = ? WHERE id = ?`;
            db.run(query,
                [resolvedFilename, resolvedPath, typology_name || doc.typology_name, document_date || doc.document_date, origen || doc.origen, id],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Documento actualizado correctamente', path: resolvedPath, filename: resolvedFilename });
                });
        };

        if (isSafeName && !newDirectPath) {
            const newFilename = resolvedFilename.endsWith('.pdf') ? resolvedFilename : `${resolvedFilename}.pdf`;
            const newPath = path.join(dir, newFilename);
            resolvedFilename = newFilename;
            resolvedPath = newPath;

            if (newFilename !== doc.filename) {
                if (fs.existsSync(newPath)) {
                    return res.status(400).json({ error: 'Ya existe un archivo con ese nombre.' });
                }
                try {
                    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
                    doUpdate();
                } catch (fsErr) {
                    console.error("Error renaming file:", fsErr);
                    res.status(500).json({ error: 'Error al renombrar el archivo físico.' });
                }
            } else {
                doUpdate();
            }
        } else {
            // Display name (long joinedName) or direct path change — just update DB
            doUpdate();
        }
    });
});

// DELETE /:id - Remove document from DB and delete physical file
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    db.get("SELECT path FROM documents WHERE id = ?", [id], (err, doc) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

        const filePath = doc.path;

        // 1. Delete physical file
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[DELETE] Archivo eliminado: ${filePath}`);
            } else {
                console.warn(`[DELETE] El archivo no existía físicamente: ${filePath}`);
            }
        } catch (fsErr) {
            console.error("[DELETE] Error eliminando archivo físico:", fsErr);
            // We continue to delete from DB even if file delete fails (maybe it was locked or permissions changed)
            // or we could stop here. Let's try to be thorough.
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
router.get('/stats/dashboard', (req, res) => {
    const user = req.user;
    const isSuperOrAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

    // Para admin/superadmin: stats globales de TODOS los expedientes
    if (isSuperOrAdmin) {
        const query = `
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
                (SELECT COUNT(*) FROM documents WHERE status = 'Cargado' 
                 AND DATE(created_at) = DATE('now')
                ) AS docs_cargados_hoy,
                (SELECT COUNT(*) FROM documents) AS total_docs
        `;
        db.get(query, [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ data: row || {}, scope: 'global' });
        });
        return;
    }

    // Para usuarios normales: stats filtradas por su dependencia (via user_trd_permissions)
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const permsQuery = `
        SELECT series_id, subseries_id FROM user_trd_permissions 
        WHERE user_id = $1 AND can_view = 1
    `;
    db.all(permsQuery, [user.id], (err, perms) => {
        if (err) return res.status(500).json({ error: 'Error verificando permisos.' });
        if (!perms || perms.length === 0) {
            return res.json({ data: {
                total_expedientes: 0, expedientes_con_docs: 0,
                expedientes_sin_docs: 0, docs_pendientes: 0,
                docs_cargados_hoy: 0, total_docs: 0
            }, scope: 'dependencia' });
        }

        const seriesIds = perms.map(p => p.series_id).filter(Boolean);
        const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);
        const paramSer = seriesIds.length > 0 ? seriesIds : [-1];
        const paramSub = subseriesIds.length > 0 ? subseriesIds : [-1];

        const statsQuery = `
            SELECT
                COUNT(DISTINCT e.id) AS total_expedientes,
                COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN e.id END) AS expedientes_con_docs,
                COUNT(DISTINCT CASE WHEN d.id IS NULL THEN e.id END) AS expedientes_sin_docs,
                COUNT(CASE WHEN d.status = 'Pendiente' THEN 1 END) AS docs_pendientes,
                COUNT(CASE WHEN d.status = 'Cargado' AND DATE(d.created_at) = DATE('now') THEN 1 END) AS docs_cargados_hoy,
                COUNT(d.id) AS total_docs
            FROM expedientes e
            LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie LIKE '%-' || sub.subseries_code)
            LEFT JOIN trd_series s ON (sub.series_id = s.id OR e.subserie = s.series_code)
            LEFT JOIN documents d ON d.expediente_id = e.id
            WHERE (s.id = ANY($1::int[]) OR sub.id = ANY($2::int[]))
        `;
        db.get(statsQuery, [paramSer, paramSub], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ data: row || {}, scope: 'dependencia' });
        });
    });
});



// ── GET /file/:id — Servir PDF con fallback automático ────────────────────────
// 1. Intenta servir desde el path registrado en BD (disco/OneDrive)
// 2. Si no existe, busca por nombre de archivo en uploads/ (backup local)
// 3. Si tampoco existe → 404
router.get('/file/:id', async (req, res) => {
    const { id } = req.params;

    db.get('SELECT path, filename FROM documents WHERE id = ?', [id], (err, doc) => {
        if (err) return res.status(500).json({ error: 'Error al consultar la base de datos.' });
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

        const primaryPath = doc.path;
        const filename = doc.filename;

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

module.exports = router;

