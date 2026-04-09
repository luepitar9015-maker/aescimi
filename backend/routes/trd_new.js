const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/temp/' });

// GET Template for Mass Upload
router.get('/template', (req, res) => {
    const wb = xlsx.utils.book_new();

    // Sheet 1: TRD_Datos
    const headers = ['Codigo_Serie', 'Nombre_Serie', 'Codigo_Subserie', 'Nombre_Subserie', 'Nombre_Tipologia'];
    const examples = [
        ['100', 'ADMINISTRACION Y PLANEACION', '', '', 'Acta de Comité'],
        ['100', 'ADMINISTRACION Y PLANEACION', '', '', 'Informe de Gestión'],
        ['200', 'GESTION DOCUMENTAL', '200.1', 'ARCHIVO DE GESTION', 'Expediente de Personal'],
        ['200', 'GESTION DOCUMENTAL', '200.1', 'ARCHIVO DE GESTION', 'Carpeta de Contrato'],
        ['200', 'GESTION DOCUMENTAL', '200.2', 'CORRESPONDENCIA', 'Memorando'],
        ['200', 'GESTION DOCUMENTAL', '200.2', 'CORRESPONDENCIA', 'Oficio'],
        ['300', 'TALENTO HUMANO', '', '', 'Hoja de Vida'],
        ['300', 'TALENTO HUMANO', '', '', 'Contrato Laboral'],
    ];
    const ws = xlsx.utils.aoa_to_sheet([headers, ...examples]);
    ws['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 18 }, { wch: 42 }, { wch: 45 }];
    xlsx.utils.book_append_sheet(wb, ws, 'TRD_Datos');

    // Sheet 2: Instrucciones
    const instrucciones = [
        ['INSTRUCCIONES PARA DILIGENCIAR LA PLANTILLA TRD'],
        [''],
        ['COLUMNA', 'DESCRIPCION', 'OBLIGATORIO', 'EJEMPLO'],
        ['Codigo_Serie', 'Código único de la Serie documental', 'SI', '100'],
        ['Nombre_Serie', 'Nombre completo de la Serie', 'SI', 'ADMINISTRACION Y PLANEACION'],
        ['Codigo_Subserie', 'Código de Subserie. DEJAR EN BLANCO si la Serie es Simple', 'NO', '200.1'],
        ['Nombre_Subserie', 'Nombre de Subserie. DEJAR EN BLANCO si la Serie es Simple', 'NO', 'ARCHIVO DE GESTION'],
        ['Nombre_Tipologia', 'Nombre de la Tipología Documental', 'SI', 'Acta de Reunión'],
        [''],
        ['REGLAS:'],
        ['1. Cada fila = una Tipología Documental.'],
        ['2. Serie Simple (sin Subseries): deje Codigo_Subserie y Nombre_Subserie en BLANCO.'],
        ['3. Serie Compleja (con Subseries): repita el Codigo_Serie/Nombre_Serie para cada fila.'],
        ['4. No modifique los nombres de columnas en la hoja TRD_Datos.'],
        ['5. Diligenciar en la hoja TRD_Datos, no aquí.'],
    ];
    const wsInstr = xlsx.utils.aoa_to_sheet(instrucciones);
    wsInstr['!cols'] = [{ wch: 20 }, { wch: 60 }, { wch: 14 }, { wch: 32 }];
    xlsx.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Carga_TRD.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});


// POST Mass Upload TRD
router.post('/upload', upload.single('file'), (req, res) => {
    const { dependency_id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!dependency_id) return res.status(400).json({ error: 'Dependency ID required' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Get dependency codes once
        db.get("SELECT regional_code, section_code, subsection_code FROM organization_structure WHERE id = ?", [dependency_id], async (err, org) => {
            if (err || !org) {
                fs.unlinkSync(req.file.path);
                return res.status(500).json({ error: "Dependency not found" });
            }

            const regCode = org.regional_code || "68";
            const depCode = org.subsection_code || org.section_code || "DEP";

            const processRow = async (row) => {
                const rawSeriesCode = row['Codigo_Serie'];
                const seriesName = row['Nombre_Serie'];
                const rawSubseriesCode = row['Codigo_Subserie'];
                const subseriesName = row['Nombre_Subserie'];
                const typologyName = row['Nombre_Tipologia'];

                if (!rawSeriesCode || !seriesName) return;

                // Format codes: REGIONAL.DEP-CODE
                const depPrefix = `${regCode}.${depCode}-`;
                const seriesCode = `${depPrefix}${rawSeriesCode}`;
                const subseriesCode = rawSubseriesCode ? (rawSubseriesCode.includes('-') ? rawSubseriesCode : `${depPrefix}${rawSubseriesCode}`) : null;

                return new Promise((resolve, reject) => {
                    // 1. Find or Create Series
                    db.get("SELECT id FROM trd_series WHERE series_code = ? AND dependency_id = ?", [seriesCode, dependency_id], (err, row) => {
                        if (err) return reject(err);

                        let seriesId;
                        const nextStep = (sId) => {
                            seriesId = sId;

                            // 2. Handle Subseries
                            if (subseriesCode && subseriesName) {
                                db.get("SELECT id FROM trd_subseries WHERE subseries_code = ? AND series_id = ?", [subseriesCode, seriesId], (err, row) => {
                                    if (err) return reject(err);

                                    const handleTypology = (subId) => {
                                        if (typologyName) {
                                            db.run("INSERT INTO trd_typologies (series_id, subseries_id, typology_name) VALUES (?, ?, ?)",
                                                [null, subId, typologyName], (err) => {
                                                    if (err) console.error("Error inserting typology:", err);
                                                    resolve();
                                                });
                                        } else {
                                            resolve();
                                        }
                                    };

                                    if (row) {
                                        handleTypology(row.id);
                                    } else {
                                        db.run("INSERT INTO trd_subseries (series_id, subseries_code, subseries_name) VALUES (?, ?, ?)",
                                            [seriesId, subseriesCode, subseriesName], function (err) {
                                                if (err) return reject(err);
                                                handleTypology(this.lastID);
                                            });
                                    }
                                });
                            } else {
                                // 3. Handle Simple Series Typology
                                if (typologyName) {
                                    db.run("INSERT INTO trd_typologies (series_id, subseries_id, typology_name) VALUES (?, ?, ?)",
                                        [seriesId, null, typologyName], (err) => {
                                            if (err) console.error("Error inserting typology:", err);
                                            resolve();
                                        });
                                } else {
                                    resolve();
                                }
                            }
                        };

                        if (row) {
                            nextStep(row.id);
                        } else {
                            db.run("INSERT INTO trd_series (dependency_id, series_code, series_name) VALUES (?, ?, ?)",
                                [dependency_id, seriesCode, seriesName], function (err) {
                                    if (err) return reject(err);
                                    nextStep(this.lastID);
                                });
                        }
                    });
                });
            };

            for (const row of data) {
                await processRow(row);
            }
            fs.unlinkSync(req.file.path);
            res.json({ message: 'Carga masiva completada exitosamente' });
        });

    } catch (err) {
        console.error("Error processing Excel:", err);
        return res.status(500).json({ error: 'Failed to process file' });
    }
});

// POST Update TRD (REPLACE ALL - deletes existing then re-imports from Excel)
router.post('/update-upload', upload.single('file'), (req, res) => {
    const { dependency_id } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!dependency_id) return res.status(400).json({ error: 'Dependency ID required' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Step 1: Delete all existing TRD for this dependency (cascade)
        db.serialize(() => {
            db.run(`DELETE FROM trd_typologies WHERE series_id IN (SELECT id FROM trd_series WHERE dependency_id = ?)
                    OR subseries_id IN (SELECT id FROM trd_subseries WHERE series_id IN (SELECT id FROM trd_series WHERE dependency_id = ?))`,
                [dependency_id, dependency_id]);
            db.run("DELETE FROM trd_subseries WHERE series_id IN (SELECT id FROM trd_series WHERE dependency_id = ?)", [dependency_id]);
            db.run("DELETE FROM trd_series WHERE dependency_id = ?", [dependency_id], async (err) => {
                if (err) {
                    fs.unlinkSync(req.file.path);
                    return res.status(500).json({ error: 'Error limpiando TRD anterior: ' + err.message });
                }

                // Get dependency codes
                db.get("SELECT regional_code, section_code, subsection_code FROM organization_structure WHERE id = ?", [dependency_id], async (err, org) => {
                    if (err || !org) {
                        fs.unlinkSync(req.file.path);
                        return res.status(500).json({ error: "Dependency not found" });
                    }
                    const regCode = org.regional_code || "68";
                    const depCode = org.subsection_code || org.section_code || "DEP";

                    // Step 2: Re-import from Excel (same logic as /upload)
                    const processRow = async (row) => {
                        const rawSeriesCode = row['Codigo_Serie'];
                        const seriesName = row['Nombre_Serie'];
                        const rawSubseriesCode = row['Codigo_Subserie'];
                        const subseriesName = row['Nombre_Subserie'];
                        const typologyName = row['Nombre_Tipologia'];
                        if (!rawSeriesCode || !seriesName) return;

                        const depPrefix = `${regCode}.${depCode}-`;
                        const seriesCode = `${depPrefix}${rawSeriesCode}`;
                        const subseriesCode = rawSubseriesCode ? (rawSubseriesCode.includes('-') ? rawSubseriesCode : `${depPrefix}${rawSubseriesCode}`) : null;

                        return new Promise((resolve, reject) => {
                            db.get("SELECT id FROM trd_series WHERE series_code = ? AND dependency_id = ?", [seriesCode, dependency_id], (err, row) => {
                                if (err) return reject(err);
                                const nextStep = (sId) => {
                                    if (subseriesCode && subseriesName) {
                                        db.get("SELECT id FROM trd_subseries WHERE subseries_code = ? AND series_id = ?", [subseriesCode, sId], (err, sRow) => {
                                            if (err) return reject(err);
                                            const handleTypology = (subId) => {
                                                if (typologyName) {
                                                    db.run("INSERT INTO trd_typologies (series_id, subseries_id, typology_name) VALUES (?, ?, ?)",
                                                        [null, subId, typologyName], () => resolve());
                                                } else { resolve(); }
                                            };
                                            if (sRow) { handleTypology(sRow.id); }
                                            else {
                                                db.run("INSERT INTO trd_subseries (series_id, subseries_code, subseries_name) VALUES (?, ?, ?)",
                                                    [sId, subseriesCode, subseriesName], function (err) {
                                                        if (err) return reject(err);
                                                        handleTypology(this.lastID);
                                                    });
                                            }
                                        });
                                    } else {
                                        if (typologyName) {
                                            db.run("INSERT INTO trd_typologies (series_id, subseries_id, typology_name) VALUES (?, ?, ?)",
                                                [sId, null, typologyName], () => resolve());
                                        } else { resolve(); }
                                    }
                                };
                                if (row) { nextStep(row.id); }
                                else {
                                    db.run("INSERT INTO trd_series (dependency_id, series_code, series_name) VALUES (?, ?, ?)",
                                        [dependency_id, seriesCode, seriesName], function (err) {
                                            if (err) return reject(err);
                                            nextStep(this.lastID);
                                        });
                                }
                            });
                        });
                    };

                    for (const row of data) { await processRow(row); }
                    fs.unlinkSync(req.file.path);
                    res.json({ message: `TRD actualizada exitosamente. ${data.length} filas procesadas.` });
                });
            });
        });
    } catch (err) {
        console.error("Error processing Excel:", err);
        return res.status(500).json({ error: 'Failed to process file' });
    }
});

// Get typologies by subseries OR series name (smart search)
router.get('/by-subseries', (req, res) => {
    const { subserie } = req.query;
    if (!subserie) return res.status(400).json({ error: 'Subserie required' });
    const like = `%${subserie}%`;

    // Search typologies attached to matching SUBSERIES
    const q1 = `
        SELECT t.id, t.typology_name as name, t.series_id, t.subseries_id,
               s.subseries_name as subseries_name, sr.series_name as series_name
        FROM trd_typologies t
        LEFT JOIN trd_subseries s ON t.subseries_id = s.id
        LEFT JOIN trd_series sr ON (t.series_id = sr.id OR s.series_id = sr.id)
        WHERE s.subseries_name ILIKE ? OR s.subseries_code ILIKE ?
    `;
    // Search typologies attached DIRECTLY to series (simple series, no subserie)
    const q2 = `
        SELECT t.id, t.typology_name as name, t.series_id, t.subseries_id,
               NULL as subseries_name, sr.series_name as series_name
        FROM trd_typologies t
        JOIN trd_series sr ON t.series_id = sr.id
        WHERE t.subseries_id IS NULL
          AND (sr.series_name ILIKE ? OR sr.series_code ILIKE ?)
    `;

    db.all(q1, [like, like], (err, rows1) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(q2, [like, like], (err, rows2) => {
            if (err) return res.status(500).json({ error: err.message });
            const combined = [...rows1, ...rows2];
            res.json({ data: combined });
        });
    });
});

// GET all subseries (flat list) for selectors - now including Simple Series (series without subseries)
router.get('/subseries/all', (req, res) => {
    const query = `
        SELECT 
            'subseries' as type,
            sub.id, 
            sub.subseries_code, 
            sub.subseries_name, 
            sub.metadata_labels, 
            s.series_code, 
            s.series_name, 
            s.metadata_labels as series_labels, 
            d.section_name, 
            d.subsection_name,
            d.regional_code,
            d.center_code,
            d.section_code,
            d.subsection_code
        FROM trd_subseries sub
        JOIN trd_series s ON sub.series_id = s.id
        LEFT JOIN organization_structure d ON s.dependency_id = d.id
        
        UNION ALL
        
        SELECT 
            'series' as type,
            s.id, 
            s.series_code as subseries_code, 
            s.series_name as subseries_name, 
            s.metadata_labels, 
            s.series_code, 
            s.series_name, 
            s.metadata_labels as series_labels, 
            d.section_name, 
            d.subsection_name,
            d.regional_code,
            d.center_code,
            d.section_code,
            d.subsection_code
        FROM trd_series s
        LEFT JOIN organization_structure d ON s.dependency_id = d.id
        
        ORDER BY subseries_code ASC
    `;

    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const allowedQ = `
            SELECT series_id, subseries_id FROM user_trd_permissions 
            WHERE user_id = $1 AND can_view = 1
        `;
        db.all(allowedQ, [req.user.id], (err, perms) => {
            if (err) return res.status(500).json({ error: err.message });
            if (perms.length === 0) return res.json({ data: [] });

            const seriesIds = perms.map(p => p.series_id).filter(Boolean);
            const subseriesIds = perms.map(p => p.subseries_id).filter(Boolean);

            let filter = " WHERE (1=0 ";
            if (seriesIds.length > 0) filter += ` OR series_id IN (${seriesIds.join(',')})`;
            if (subseriesIds.length > 0) filter += ` OR id IN (${subseriesIds.join(',')})`;
            filter += ")";

            // We need to apply filter to both parts of UNION if we want to be exact, or wrap the whole things
            const wrappedQuery = `SELECT * FROM (${query}) AS all_trd WHERE (1=0 `;
            let filterParts = [];
            if (seriesIds.length > 0) filterParts.push(`series_id IN (${seriesIds.join(',')})`);
            if (subseriesIds.length > 0) filterParts.push(`id IN (${subseriesIds.join(',')})`);
            const finalWrapped = `SELECT * FROM (${query}) AS all_trd WHERE ${filterParts.join(' OR ')} ORDER BY subseries_code ASC`;

            db.all(finalWrapped, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                handleRows(rows);
            });
        });
        return;
    }

    const handleRows = (rows) => {
        const processed = rows.map(r => {
            let meta = null;
            try {
                meta = r.metadata_labels ? JSON.parse(r.metadata_labels) : (r.series_labels ? JSON.parse(r.series_labels) : null);
            } catch (e) {
                console.error("Error parsing metadata_labels:", e, r.id);
            }

            const trd_code = r.type === 'subseries' ? (r.subseries_code || '') : (r.series_code || '');

            let concat = '';
            if (trd_code.includes('.')) {
                concat = trd_code;
            } else {
                const reg = r.regional_code || '';
                const ctr = r.center_code || '';
                const sec = r.section_code || '';
                const sub = r.subsection_code ? `.${r.subsection_code}` : '';
                const prefixParts = [reg, ctr, sec].filter(Boolean);
                const prefix = prefixParts.join('.');
                if (prefix) concat = `${prefix}${sub}-${trd_code}`;
                else concat = trd_code;
            }

            let bare = trd_code;
            if (bare.indexOf('-') !== -1) {
                const parts = bare.split('-');
                bare = parts[parts.length - 1];
            }
            if (bare.indexOf('.') !== -1) {
                const parts = bare.split('.');
                bare = parts[parts.length - 1];
            }

            return {
                ...r,
                metadata_labels: meta,
                concatenated_code: concat,
                bare_code: bare
            };
        });
        res.json({ data: processed });
    };

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        handleRows(rows);
    });
});

// GET all typologies for an expediente (searches BOTH subseries AND series name/code)
router.get('/typologies-for-expediente', (req, res) => {
    const { subserie, series } = req.query;
    const results = [];

    const sendResult = () => res.json({ data: results });

    // Query 1: match by subserie code or name
    if (subserie) {
        const exact = subserie;
        const like = `%${subserie}%`;
        const endsWith = `%-${subserie}`;
        const endsWithDot = `%.${subserie}`;

        db.all(`
            SELECT t.id, t.typology_name as name, t.series_id, t.subseries_id
            FROM trd_typologies t
            LEFT JOIN trd_subseries sub ON t.subseries_id = sub.id
            LEFT JOIN trd_series sr ON (sub.series_id = sr.id OR t.series_id = sr.id)
            WHERE sub.subseries_code = ? OR sub.subseries_code ILIKE ? OR sub.subseries_code ILIKE ? OR sub.subseries_name ILIKE ?
               OR sr.series_code = ? OR sr.series_code ILIKE ? OR sr.series_code ILIKE ? OR sr.series_name ILIKE ?
        `, [exact, endsWith, endsWithDot, like, exact, endsWith, endsWithDot, like], (err, rows) => {
            if (!err && rows) rows.forEach(r => { if (!results.find(x => x.id === r.id)) results.push(r); });
            sendResult();
        });
    } else if (series) {
        const exact = series;
        const like = `%${series}%`;
        db.all(`
            SELECT t.id, t.typology_name as name, t.series_id, t.subseries_id
            FROM trd_typologies t
            LEFT JOIN trd_series sr ON t.series_id = sr.id
            WHERE sr.series_code = ? OR sr.series_name ILIKE ?
        `, [exact, like], (err, rows) => {
            if (!err && rows) rows.forEach(r => results.push(r));
            sendResult();
        });
    } else {
        sendResult();
    }
});


// GET all typologies (fallback for unmatched expedientes)
router.get('/all-typologies', (req, res) => {
    db.all(`
        SELECT t.id, t.typology_name as name, t.series_id, t.subseries_id,
               sr.series_code, sr.series_name, sub.subseries_code, sub.subseries_name
        FROM trd_typologies t
        LEFT JOIN trd_series sr ON (t.series_id = sr.id)
        LEFT JOIN trd_subseries sub ON (t.subseries_id = sub.id)
        ORDER BY sr.series_code, sub.subseries_code, t.typology_name
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// GET TRD tree for a specific dependency

router.get('/:dependencyId', (req, res) => {
    const { dependencyId } = req.params;

    // Complex query to fetch Series -> Subseries -> Typologies
    // This is a simplified fetch; in production/complex apps, separate queries or a good JOIN is needed.
    // For SQLite, we'll fetch series first, then attach subseries/typologies.

    const query = `
        SELECT 
            s.id as series_id, s.series_code, s.series_name, s.folder_hierarchy as series_hierarchy, s.metadata_labels as series_labels,
            sub.id as subseries_id, sub.subseries_code, sub.subseries_name, sub.folder_hierarchy as subseries_hierarchy, sub.metadata_labels as subseries_labels,
            t.id as typology_id, t.typology_name, t.subseries_id as typ_sub_id, t.series_id as typ_ser_id
        FROM trd_series s
        LEFT JOIN trd_subseries sub ON s.id = sub.series_id
        LEFT JOIN trd_typologies t ON (t.series_id = s.id OR t.subseries_id = sub.id)
        WHERE s.dependency_id = ?
        ORDER BY s.series_code, sub.subseries_code, t.id ASC
    `;

    db.all(query, [dependencyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Transform flat JOIN data into Tree
        const trdTree = {};

        rows.forEach(row => {
            // Series Level
            if (!trdTree[row.series_id]) {
                trdTree[row.series_id] = {
                    id: row.series_id,
                    code: row.series_code,
                    name: row.series_name,
                    folder_hierarchy: row.series_hierarchy,
                    metadata_labels: row.series_labels,
                    subseries: {}, // Map for subseries
                    typologies: [] // Direct typologies (Simple Series)
                };
            }

            // Subseries Level
            if (row.subseries_id) {
                if (!trdTree[row.series_id].subseries[row.subseries_id]) {
                    trdTree[row.series_id].subseries[row.subseries_id] = {
                        id: row.subseries_id,
                        code: row.subseries_code,
                        name: row.subseries_name,
                        folder_hierarchy: row.subseries_hierarchy,
                        metadata_labels: row.subseries_labels,
                        typologies: []
                    };
                }

                // Typology attached to Subseries
                if (row.typology_id && row.typ_sub_id === row.subseries_id) {
                    trdTree[row.series_id].subseries[row.subseries_id].typologies.push({
                        id: row.typology_id,
                        name: row.typology_name
                    });
                }
            } else {
                // Typology attached directly to Series (Simple)
                if (row.typology_id && row.typ_ser_id === row.series_id) {
                    trdTree[row.series_id].typologies.push({
                        id: row.typology_id,
                        name: row.typology_name
                    });
                }
            }
        });

        // Convert Maps to Arrays for frontend
        const result = Object.values(trdTree).map(series => ({
            ...series,
            folder_hierarchy: series.folder_hierarchy ? JSON.parse(series.folder_hierarchy) : null,
            metadata_labels: series.metadata_labels ? JSON.parse(series.metadata_labels) : null,
            subseries: Object.values(series.subseries).map(sub => ({
                ...sub,
                folder_hierarchy: sub.folder_hierarchy ? JSON.parse(sub.folder_hierarchy) : null,
                metadata_labels: sub.metadata_labels ? JSON.parse(sub.metadata_labels) : null
            }))
        }));

        res.json(result);
    });
});

// POST Create Series
router.post('/series', (req, res) => {
    const { dependency_id, code, name } = req.body;

    // Get dependency code to prefix
    db.get("SELECT regional_code, section_code, subsection_code FROM organization_structure WHERE id = ?", [dependency_id], (err, org) => {
        if (err || !org) return res.status(500).json({ error: "Dependency not found" });

        const regCode = org.regional_code || "68";
        const depCode = org.subsection_code || org.section_code || "DEP";
        const formattedCode = `${regCode}.${depCode}-${code}`;

        db.run(
            "INSERT INTO trd_series (dependency_id, series_code, series_name) VALUES (?, ?, ?)",
            [dependency_id, formattedCode, name],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, message: "Series Created", code: formattedCode });
            }
        );
    });
});

// POST Create Subseries
router.post('/subseries', (req, res) => {
    const { series_id, code, name } = req.body;

    // Get parent series code
    db.get("SELECT series_code FROM trd_series WHERE id = ?", [series_id], (err, series) => {
        if (err || !series) return res.status(500).json({ error: "Parent series not found" });

        const depPrefix = series.series_code.split('-')[0] + '-';
        const formattedCode = code.includes('-') ? code : `${depPrefix}${code}`;

        db.run(
            "INSERT INTO trd_subseries (series_id, subseries_code, subseries_name) VALUES (?, ?, ?)",
            [series_id, formattedCode, name],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, message: "Subseries Created", code: formattedCode });
            }
        );
    });
});

// POST Create Typology
router.post('/typology', (req, res) => {
    const { series_id, subseries_id, name } = req.body;

    db.run(
        "INSERT INTO trd_typologies (series_id, subseries_id, typology_name) VALUES (?, ?, ?)",
        [series_id || null, subseries_id || null, name],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: "Typology Created" });
        }
    );
});

// PUT Edit Series
router.put('/series/:id', (req, res) => {
    const { code, name } = req.body;
    db.run("UPDATE trd_series SET series_code = ?, series_name = ? WHERE id = ?",
        [code, name, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Serie actualizada' });
        });
});

// DELETE Series (cascade: subseries + typologies)
router.delete('/series/:id', (req, res) => {
    const id = req.params.id;
    db.serialize(() => {
        db.run("DELETE FROM trd_typologies WHERE series_id = ? OR subseries_id IN (SELECT id FROM trd_subseries WHERE series_id = ?)", [id, id]);
        db.run("DELETE FROM trd_subseries WHERE series_id = ?", [id]);
        db.run("DELETE FROM trd_series WHERE id = ?", [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Serie eliminada' });
        });
    });
});

// PUT Edit Subseries
router.put('/subseries/:id', (req, res) => {
    const { code, name } = req.body;
    db.run("UPDATE trd_subseries SET subseries_code = ?, subseries_name = ? WHERE id = ?",
        [code, name, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Subserie actualizada' });
        });
});

// DELETE Subseries (cascade: typologies)
router.delete('/subseries/:id', (req, res) => {
    const id = req.params.id;
    db.serialize(() => {
        db.run("DELETE FROM trd_typologies WHERE subseries_id = ?", [id]);
        db.run("DELETE FROM trd_subseries WHERE id = ?", [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Subserie eliminada' });
        });
    });
});

// PUT Edit Typology
router.put('/typology/:id', (req, res) => {
    const { name } = req.body;
    db.run("UPDATE trd_typologies SET typology_name = ? WHERE id = ?",
        [name, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Tipología actualizada' });
        });
});

// POST Update Hierarchy for Series or Subseries
router.post('/hierarchy', (req, res) => {
    const { type, id, hierarchy } = req.body; // type: 'series' | 'subseries'
    console.log('[TRD] POST /hierarchy - type:', type, 'id:', id, 'hierarchy:', JSON.stringify(hierarchy));
    if (!type || !id) return res.status(400).json({ error: 'Type and ID required' });

    const table = type === 'series' ? 'trd_series' : 'trd_subseries';
    const query = `UPDATE ${table} SET folder_hierarchy = ? WHERE id = ?`;

    db.run(query, [JSON.stringify(hierarchy), id], function (err) {
        if (err) {
            console.error('[TRD] Error updating hierarchy:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('[TRD] Hierarchy updated. Changes:', this.changes);
        res.json({ message: 'Jerarquía actualizada', changes: this.changes });
    });
});


// POST Update Metadata Labels for Series or Subseries
router.post('/metadata-labels', (req, res) => {
    const { type, id, labels } = req.body; // type: 'series' | 'subseries'
    if (!type || !id) return res.status(400).json({ error: 'Type and ID required' });

    const table = type === 'series' ? 'trd_series' : 'trd_subseries';
    const query = `UPDATE ${table} SET metadata_labels = ? WHERE id = ?`;

    db.run(query, [JSON.stringify(labels), id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Etiquetas de metadatos actualizadas' });
    });
});

module.exports = router;

