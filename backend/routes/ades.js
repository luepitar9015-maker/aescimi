const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');
const { recordAesDocConfirmation } = require('./aes_confirmations');

// Resolutor inteligente de rutas físicas de documentos en servidor (soporta /mnt/almacen/9224 vs /689224/ y rutas relativas)
const resolveDocumentPath = (docPath, filename) => {
    if (!docPath) return null;
    
    // 1. Verificación directa de ruta original
    if (fs.existsSync(docPath)) return docPath;

    // Normalizar barras inclinadas
    const normalizedPath = docPath.replace(/\\/g, '/');
    if (fs.existsSync(normalizedPath)) return normalizedPath;

    // 2. Variaciones directas del almacenamiento SENA
    const variations = [
        normalizedPath.replace('/mnt/almacen/689224/', '/mnt/almacen/9224/'),
        normalizedPath.replace('/689224/', '/9224/'),
        normalizedPath.replace('/689224/', '/68/9224/'),
        normalizedPath.replace('/mnt/almacen/', '/mnt/almacen/9224/')
    ];

    for (const v of variations) {
        if (fs.existsSync(v)) return v;
    }

    // 3. Fallback por nombre de archivo y carpeta de radicado/expediente
    const fileBasename = filename || path.basename(normalizedPath);
    const parts = normalizedPath.split('/').filter(Boolean);
    const folderRadicado = parts.length >= 2 ? parts[parts.length - 2] : null;

    if (folderRadicado && fileBasename) {
        const candidatePaths = [
            `/mnt/almacen/9224/68922427/${folderRadicado}/${fileBasename}`,
            `/mnt/almacen/9224/68922437/${folderRadicado}/${fileBasename}`,
            `/mnt/almacen/9224/${folderRadicado}/${fileBasename}`,
            `/mnt/almacen/${folderRadicado}/${fileBasename}`
        ];
        for (const cp of candidatePaths) {
            if (fs.existsSync(cp)) return cp;
        }
    }

    // 4. Intentar ruta relativa dentro de uploads/
    if (fileBasename) {
        const uploadsPath = path.join(__dirname, '../uploads', fileBasename);
        if (fs.existsSync(uploadsPath)) return uploadsPath;
    }

    return null;
};

// Helper inteligente para resolver Dependencia y Usuario OnBase según TRD y estructura organizativa
const resolveDocDependency = (row, orgList = [], sessionUser = null) => {
    const text = `${row.subserie || ''} ${row.filename || ''} ${row.expediente_code || ''} ${row.title || ''}`.toUpperCase();

    const findOrg = (secCode, subCode) => {
        return orgList.find(o => 
            (subCode ? o.subsection_code === subCode : (!o.subsection_code || o.subsection_code === ''))
        ) || null;
    };

    const orgSubdireccion = findOrg('9224', '') || { id: 6, section_name: 'SUBDIRECCION DE CENTRO', subsection_name: '', onbase_user: 'TVILLAMIZARJ' };
    const orgAdminEducativa = findOrg('9224', '9224.2') || { id: 7, section_name: 'SUBDIRECCION DE CENTRO', subsection_name: 'GRUPO ADMINISTRACION EDUCATIVA', onbase_user: 'luepitar' };
    const orgFormacion = findOrg('9224', '9224.4') || { id: 8, section_name: 'SUBDIRECCION DE CENTRO', subsection_name: 'GRUPO DE FORMACION PROFESIONAL INTEGRAL', onbase_user: 'EDHERNANDEZM' };

    // 1. Detección por código de subserie o serie TRD
    if (text.includes('9224.4') || text.includes('68.9224.4')) {
        return {
            dependency_id: 8,
            dependency_name: orgFormacion.subsection_name || 'Formación Profesional Integral',
            dependency_code: '9224.4',
            onbase_user: orgFormacion.onbase_user || 'EDHERNANDEZM',
            rule: 'TRD 9224.4'
        };
    }
    if (text.includes('9224.2') || text.includes('68.9224.2')) {
        return {
            dependency_id: 7,
            dependency_name: orgAdminEducativa.subsection_name || 'Administración Educativa',
            dependency_code: '9224.2',
            onbase_user: orgAdminEducativa.onbase_user || 'luepitar',
            rule: 'TRD 9224.2'
        };
    }
    if (text.includes('68.9224-') || text.includes('9224-') || text.includes('68.9224/')) {
        return {
            dependency_id: 6,
            dependency_name: orgSubdireccion.section_name || 'Subdirección de Centro',
            dependency_code: '9224',
            onbase_user: orgSubdireccion.onbase_user || 'TVILLAMIZARJ',
            rule: 'TRD 9224'
        };
    }

    // 2. Por organization_id del documento
    if (row.organization_id === 8) {
        return { dependency_id: 8, dependency_name: orgFormacion.subsection_name || 'Formación Profesional Integral', dependency_code: '9224.4', onbase_user: orgFormacion.onbase_user || 'EDHERNANDEZM', rule: 'Org ID 8' };
    }
    if (row.organization_id === 7) {
        return { dependency_id: 7, dependency_name: orgAdminEducativa.subsection_name || 'Administración Educativa', dependency_code: '9224.2', onbase_user: orgAdminEducativa.onbase_user || 'luepitar', rule: 'Org ID 7' };
    }
    if (row.organization_id === 6) {
        return { dependency_id: 6, dependency_name: orgSubdireccion.section_name || 'Subdirección de Centro', dependency_code: '9224', onbase_user: orgSubdireccion.onbase_user || 'TVILLAMIZARJ', rule: 'Org ID 6' };
    }

    // 3. Por dependencia del usuario autenticado (si no es admin)
    if (sessionUser && sessionUser.organization_id) {
        if (sessionUser.organization_id === 8) {
            return { dependency_id: 8, dependency_name: orgFormacion.subsection_name || 'Formación Profesional Integral', dependency_code: '9224.4', onbase_user: orgFormacion.onbase_user || 'EDHERNANDEZM', rule: 'Usuario Sesión (Formación)' };
        }
        if (sessionUser.organization_id === 7) {
            return { dependency_id: 7, dependency_name: orgAdminEducativa.subsection_name || 'Administración Educativa', dependency_code: '9224.2', onbase_user: orgAdminEducativa.onbase_user || 'luepitar', rule: 'Usuario Sesión (Adm. Educativa)' };
        }
    }

    // Fallback: Subdirección
    return {
        dependency_id: 6,
        dependency_name: orgSubdireccion.section_name || 'Subdirección de Centro',
        dependency_code: '9224',
        onbase_user: orgSubdireccion.onbase_user || 'TVILLAMIZARJ',
        rule: 'Por Defecto (Subdirección)'
    };
};

// Helper to validate if an expediente has at least its first three typologies uploaded
const validateExpedienteTypologies = (expedienteId, callback) => {
    const trdQ = `
        SELECT UPPER(UNACCENT(tt.typology_name)) as typology_name
        FROM expedientes e
        LEFT JOIN trd_subseries sub ON (e.subserie = sub.subseries_code OR e.subserie ILIKE '%-' || sub.subseries_code)
        LEFT JOIN trd_series ser ON (sub.series_id = ser.id OR e.subserie = ser.series_code)
        LEFT JOIN trd_typologies tt ON (tt.subseries_id = sub.id OR (tt.subseries_id IS NULL AND tt.series_id = ser.id))
        WHERE e.id = ?
        ORDER BY tt.id ASC
        LIMIT 3
    `;
    db.all(trdQ, [expedienteId], (err, typRows) => {
        if (err || !typRows || typRows.length === 0) {
            return callback(null, true); // Si no hay tipologías, pasa
        }

        const requiredTypologies = typRows.map(r => r.typology_name);

        const docsQ = `
            SELECT DISTINCT UPPER(UNACCENT(typology_name)) as typology_name 
            FROM documents 
            WHERE expediente_id = ?
        `;
        db.all(docsQ, [expedienteId], (err, docRows) => {
            if (err || !docRows) {
                return callback(null, true);
            }

            const uploadedTypologies = docRows.map(r => r.typology_name);

            // Check if ALL required typologies are in uploadedTypologies
            const hasAll = requiredTypologies.every(reqTyp => uploadedTypologies.includes(reqTyp));
            callback(null, hasAll);
        });
    });
};

// Get documents for ADES load — acepta ?status=Pendiente|Cargado|Todos (default: Pendiente)
router.get('/pending', requireAuth, (req, res) => {
    const { status } = req.query;
    const activeStatus = status || 'Pendiente';
    
    const params = [];
    let whereClause = '';

    if (activeStatus === 'Todos' || activeStatus === 'Verificador') {
        whereClause = "WHERE (e.expediente_code IS NOT NULL AND TRIM(e.expediente_code) != '')";
    } else if (activeStatus === 'SinCódigo' || activeStatus === 'Sin Código') {
        let subPerms = '';
        const subParams = [];
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            subPerms = ` AND organization_id = ? 
                         AND (trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
            subParams.push(req.user.organization_id || 0, req.user.id, req.user.id);
        }
        whereClause = `WHERE (
            (d.expediente_id IS NOT NULL AND d.expediente_id IN (
                SELECT DISTINCT expediente_id FROM documents WHERE status = 'Pendiente' AND expediente_id IS NOT NULL ${subPerms}
            )) OR 
            (d.expediente_id IS NULL AND d.status = 'Pendiente')
        ) AND (e.expediente_code IS NULL OR TRIM(COALESCE(e.expediente_code, '')) = '')`;
        params.push(...subParams);
    } else if (activeStatus === 'Pendiente') {
        let subPerms = '';
        const subParams = [];
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            subPerms = ` AND organization_id = ? 
                         AND (trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
            subParams.push(req.user.organization_id || 0, req.user.id, req.user.id);
        }
        whereClause = `WHERE (
            (d.expediente_id IS NOT NULL AND d.expediente_id IN (
                SELECT DISTINCT expediente_id FROM documents WHERE status = 'Pendiente' AND expediente_id IS NOT NULL ${subPerms}
            )) OR 
            (d.expediente_id IS NULL AND d.status = 'Pendiente')
        ) AND (e.expediente_code IS NOT NULL AND TRIM(e.expediente_code) != '')`;
        params.push(...subParams);
    } else {
        whereClause = `WHERE d.status = '${activeStatus}' AND (e.expediente_code IS NOT NULL AND TRIM(e.expediente_code) != '')`;
    }

    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        whereClause += ` AND d.organization_id = ? 
                         AND (d.trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR d.trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
        params.push(req.user.organization_id || 0, req.user.id, req.user.id);
    }

    const reqDepFilter = req.query.dependency ? String(req.query.dependency).trim() : null;
    if (reqDepFilter === '9224') {
        whereClause += ` AND (e.subserie LIKE '%9224-%' OR (e.subserie IS NULL AND (d.organization_id = 6 OR d.organization_id IS NULL)))`;
    } else if (reqDepFilter === '9224.2') {
        whereClause += ` AND (e.subserie LIKE '%9224.2%' OR (e.subserie IS NULL AND d.organization_id = 7))`;
    } else if (reqDepFilter === '9224.4') {
        whereClause += ` AND (e.subserie LIKE '%9224.4%' OR (e.subserie IS NULL AND d.organization_id = 8))`;
    }

    const query = `
        SELECT 
            d.*, 
            d.storage_path,
            e.expediente_code, 
            e.title, 
            e.metadata_values as expediente_metadata,
            e.box_id,
            e.opening_date,
            e.subserie,
            e.storage_type
        FROM documents d
        LEFT JOIN expedientes e ON d.expediente_id = e.id
        ${whereClause}
        LIMIT 50000
    `;
    db.all(query, params, async (err, rawRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const [serRows, subRows, typRows] = await Promise.all([
            new Promise(r => db.all("SELECT id, series_code, series_name FROM trd_series", [], (_, d) => r(d || []))),
            new Promise(r => db.all("SELECT id, series_id, subseries_code, subseries_name FROM trd_subseries", [], (_, d) => r(d || []))),
            new Promise(r => db.all("SELECT id, typology_name, onbase_name FROM trd_typologies ORDER BY id ASC", [], (_, d) => r(d || [])))
        ]);

        const serById = new Map();
        const serByCode = new Map();
        serRows.forEach(s => {
            serById.set(s.id, s);
            if (s.series_code) serByCode.set(String(s.series_code).trim(), s);
        });
        const subById = new Map();
        subRows.forEach(sb => subById.set(sb.id, sb));

        const cleanTyp = (s) => String(s || '').trim().replace(/^[0-9]+\s*[._)-]\s*/, '').replace(/_[0-9]+$/, '').trim().toUpperCase();
        const typMap = new Map();
        typRows.forEach(t => {
            const k = cleanTyp(t.typology_name);
            if (!k) return;
            const prev = typMap.get(k);
            if (!prev) {
                typMap.set(k, { min_id: t.id, onbase_name: t.onbase_name || null });
            } else {
                if (t.id < prev.min_id) prev.min_id = t.id;
                if (!prev.onbase_name && t.onbase_name) prev.onbase_name = t.onbase_name;
            }
        });

        const rows = (rawRows || []).map(r => {
            const eSub = String(r.subserie || '').trim();
            let sb = r.trd_subseries_id ? subById.get(r.trd_subseries_id) : null;
            if (!sb && eSub) {
                sb = subRows.find(x => x.subseries_code === eSub || eSub.toUpperCase().endsWith('-' + String(x.subseries_code || '').toUpperCase())) || null;
            }
            let sr = r.trd_series_id ? serById.get(r.trd_series_id) : (sb ? serById.get(sb.series_id) : null);
            if (!sr && eSub) sr = serByCode.get(eSub) || null;

            const tInfo = typMap.get(cleanTyp(r.typology_name));
            return {
                ...r,
                subserie_name: sb?.subseries_name || sr?.series_name || '',
                series_name: sr?.series_name || '',
                typology_order: tInfo ? tInfo.min_id : 9999,
                onbase_name: tInfo ? tInfo.onbase_name : null
            };
        });

        rows.sort((a, b) => {
            if (activeStatus === 'Cargado') {
                const la = String(a.load_date || '');
                const lb = String(b.load_date || '');
                if (la !== lb) return lb.localeCompare(la);
            } else {
                const sa = String(a.subserie || '').trim() || 'ZZZZ';
                const sb = String(b.subserie || '').trim() || 'ZZZZ';
                if (sa !== sb) return sa.localeCompare(sb);
                const ea = String(a.expediente_code || '').trim() || 'ZZZZ';
                const eb = String(b.expediente_code || '').trim() || 'ZZZZ';
                if (ea !== eb) return ea.localeCompare(eb);
            }
            if (a.typology_order !== b.typology_order) return a.typology_order - b.typology_order;
            return (a.id || 0) - (b.id || 0);
        });

        // Get unique expedientes
        const expMap = new Map();
        rows.forEach(r => {
            if (r.expediente_id && !expMap.has(r.expediente_id)) {
                expMap.set(r.expediente_id, true);
            }
        });

        // Run validation for each unique expediente con concurrencia controlada (máx 15 en paralelo para soportar 4000+ expedientes)
        const validationResults = {};
        const isUserAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

        if (!isUserAdmin) {
            const expIdsList = Array.from(expMap.keys());
            const CONCURRENCY = 15;
            for (let i = 0; i < expIdsList.length; i += CONCURRENCY) {
                const chunk = expIdsList.slice(i, i + CONCURRENCY);
                await Promise.all(chunk.map(id => new Promise(resolve => {
                    validateExpedienteTypologies(id, (err, hasAll) => {
                        validationResults[id] = hasAll;
                        resolve();
                    });
                })));
            }
        }

        // Obtener dependencias para asignación inteligente
        db.all("SELECT id, section_name, subsection_name, section_code, subsection_code, onbase_user, onbase_pass FROM organization_structure", [], (orgErr, orgRows) => {
            const orgList = orgRows || [];
            const processed = [];
            const reqDep = req.query.dependency ? String(req.query.dependency).trim() : null;

            // Control de duplicados y orden de oleada de tipología por expediente
            const seenTypByExp = new Map();
            const waveCounterByExp = new Map();
            const normTypName = (t, fname = '') => {
                const base = String(t || '').trim().replace(/^[0-9]+\s*[._)-]\s*/, '').replace(/_[0-9]+$/, '').toUpperCase();
                const sfx = String(fname || '').match(/_([2-9]|[1-9][0-9]+)(?=\.[^.]+$|$)/);
                return sfx ? `${base}__ANEXO_${sfx[1]}` : base;
            };

            rows.forEach(row => {
                let docMeta = {};
                let expMeta = {};
                try { if (row.metadata_values) docMeta = JSON.parse(row.metadata_values); } catch (e) {}
                try { if (row.expediente_metadata) expMeta = JSON.parse(row.expediente_metadata); } catch (e) {}
                
                const expId = row.expediente_id;
                const hasFirstThree = expId ? (validationResults[expId] ?? true) : true;

                // If not admin/superadmin, and it doesn't have the first three, we omit it.
                if (!isUserAdmin && !hasFirstThree) {
                    return; // skip
                }

                const resolvedPath = row.path;
                const depInfo = resolveDocDependency(row, orgList, req.user);

                // Si se filtró explícitamente por dependencia en la consulta
                if (reqDep) {
                    if (reqDep === '9224' && depInfo.dependency_code !== '9224') return;
                    if (reqDep === '9224.2' && depInfo.dependency_code !== '9224.2') return;
                    if (reqDep === '9224.4' && depInfo.dependency_code !== '9224.4') return;
                }

                const expKey = expId || `DOC_${row.id}`;
                const cleanTypKey = normTypName(row.typology_name || row.filename, row.filename);
                if (!seenTypByExp.has(expKey)) seenTypByExp.set(expKey, new Set());
                const expTypSet = seenTypByExp.get(expKey);
                const isDuplicateTypology = cleanTypKey ? expTypSet.has(cleanTypKey) : false;
                if (cleanTypKey) expTypSet.add(cleanTypKey);

                const nextWaveIdx = (waveCounterByExp.get(expKey) || 0) + 1;
                waveCounterByExp.set(expKey, nextWaveIdx);

                processed.push({
                    ...row,
                    path: resolvedPath,
                    document_metadata: docMeta && typeof docMeta === 'object' ? docMeta : {},
                    expediente_metadata: expMeta && typeof expMeta === 'object' ? expMeta : {},
                    has_first_three_typologies: hasFirstThree,
                    dependency_id: depInfo.dependency_id,
                    dependency_name: depInfo.dependency_name,
                    dependency_code: depInfo.dependency_code,
                    target_onbase_user: depInfo.onbase_user,
                    trd_rule: depInfo.rule,
                    is_duplicate_typology: isDuplicateTypology,
                    typology_wave_index: nextWaveIdx
                });
            });

            res.json(processed);
        });
    });
});


// Get ALL documents with optional status filter (?status=Pendiente|Cargado|Todos)
router.get('/all', requireAuth, (req, res) => {
    const { status } = req.query; // 'Pendiente', 'Cargado', o vacío/Todos
    let whereClause = status && status !== 'Todos' ? `WHERE d.status = '${status}'` : 'WHERE 1=1';

    const params = [];
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        whereClause += ` AND d.organization_id = ? 
                         AND (d.trd_series_id IN (SELECT series_id FROM user_trd_permissions WHERE user_id = ?) 
                              OR d.trd_subseries_id IN (SELECT subseries_id FROM user_trd_permissions WHERE user_id = ?))`;
        params.push(req.user.organization_id || 0, req.user.id, req.user.id);
    }

    const query = `
        SELECT 
            d.*, 
            e.expediente_code, 
            e.title, 
            e.metadata_values as expediente_metadata,
            e.box_id,
            e.opening_date,
            e.subserie,
            e.storage_type,
            COALESCE(t_min.min_id, 9999) as typology_order
        FROM documents d
        JOIN expedientes e ON d.expediente_id = e.id
        LEFT JOIN (
            SELECT typology_name, MIN(id) as min_id
            FROM trd_typologies
            GROUP BY typology_name
        ) t_min ON d.typology_name = t_min.typology_name
        ${whereClause}
        ORDER BY d.load_date DESC, typology_order ASC, d.created_at ASC
        LIMIT 50000
    `;
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all("SELECT id, section_name, subsection_name, section_code, subsection_code, onbase_user, onbase_pass FROM organization_structure", [], (orgErr, orgRows) => {
            const orgList = orgRows || [];
            const processed = rows.map(row => {
                let docMeta = {};
                let expMeta = {};
                try { if (row.metadata_values) docMeta = JSON.parse(row.metadata_values); } catch (e) {}
                try { if (row.expediente_metadata) expMeta = JSON.parse(row.expediente_metadata); } catch (e) {}
                const resolvedPath = row.path;
                const depInfo = resolveDocDependency(row, orgList, req.user);
                return {
                    ...row,
                    path: resolvedPath,
                    document_metadata: docMeta && typeof docMeta === 'object' ? docMeta : {},
                    expediente_metadata: expMeta && typeof expMeta === 'object' ? expMeta : {},
                    dependency_id: depInfo.dependency_id,
                    dependency_name: depInfo.dependency_name,
                    dependency_code: depInfo.dependency_code,
                    target_onbase_user: depInfo.onbase_user,
                    trd_rule: depInfo.rule
                };
            });
            res.json(processed);
        });
    });
});


// Update document status after ADES load
router.post('/update-status', (req, res) => {
    const { id, status, ades_id } = req.body;
    const isCargado = status === 'Cargado';
    const load_date = isCargado ? new Date().toISOString() : null;
    const verifiedVal = isCargado ? 2 : 0;
    const verifyStage = isCargado ? 'Verificado Manualmente OK ✅' : null;

    const query = `
        UPDATE documents 
        SET status = ?, ades_id = ?, load_date = ?, onbase_verified = ?, onbase_verify_stage = ?, onbase_verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    db.run(query, [status, ades_id || null, load_date, verifiedVal, verifyStage, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (isCargado && id) {
            recordAesDocConfirmation({
                documentId: id,
                batchId: `MANUAL-${new Date().toISOString().slice(0, 10)}`,
                botKey: 'MANUAL',
                onbaseUser: req.user?.name || 'MANUAL',
                operatorName: req.user?.name || null,
                startedAt: load_date,
                confirmedAt: load_date,
                sourceMode: 'CONFIRMACION_MANUAL'
            }).catch(() => {});
        }
        res.json({ message: 'Document status updated', id });
    });
});

// Serve document file content con auto-resolución de rutas
router.get('/view/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT id, path, filename FROM documents WHERE id = ?", [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Documento no encontrado' });

        const validPath = resolveDocumentPath(doc.path, doc.filename);

        if (!validPath) {
            console.error(`[VIEW] Archivo no encontrado en disco ni rutas alternativas: ID=${id}, Path=${doc.path}`);
            return res.status(404).json({ error: 'Archivo no encontrado en el servidor. La ruta física especificada no existe en el almacenamiento del servidor.' });
        }

        // Auto-reparar ruta en la base de datos si la ruta resuelta difiere
        if (validPath !== doc.path) {
            db.run("UPDATE documents SET path = ? WHERE id = ?", [validPath, id], (uErr) => {
                if (!uErr) console.log(`[AUTO-HEAL] Ruta física actualizada en BD para documento ID=${id}: ${validPath}`);
            });
        }

        const ext = path.extname(validPath).toLowerCase();
        let contentType = 'application/pdf';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.txt') contentType = 'text/plain';

        res.setHeader('Content-Type', contentType);
        const safeHeaderName = String(doc.filename || path.basename(validPath) || 'documento.pdf').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
        res.setHeader('Content-Disposition', `inline; filename="${safeHeaderName}"`);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        fs.createReadStream(validPath).pipe(res);
    });
});

// Marcar documentos/expedientes como Cargado
router.post('/mark-cargado', requireAuth, (req, res) => {
    const { expediente_codes } = req.body;
    if (!Array.isArray(expediente_codes) || expediente_codes.length === 0) {
        return res.status(400).json({ error: 'Se requiere una lista de expediente_codes' });
    }

    const cleanedCodes = expediente_codes.map(c => String(c).trim()).filter(Boolean);
    let completedCount = 0;
    let totalUpdated = 0;

    cleanedCodes.forEach(code => {
        const findExpSql = `
            SELECT id FROM expedientes 
            WHERE expediente_code ILIKE ? OR title ILIKE ? OR metadata_values ILIKE ?
        `;
        db.all(findExpSql, [`%${code}%`, `%${code}%`, `%${code}%`], (err, exps) => {
            const expIds = (exps || []).map(e => e.id);
            
            if (expIds.length > 0) {
                const placeholders = expIds.map(() => '?').join(',');
                db.run(`UPDATE documents SET status = 'Cargado', load_date = NOW() WHERE expediente_id IN (${placeholders})`, expIds, function() {
                    totalUpdated += this.changes || 0;
                    checkDone();
                });
            } else {
                checkDone();
            }

            db.run(`UPDATE documents SET status = 'Cargado', load_date = NOW() WHERE filename ILIKE ? OR metadata_values ILIKE ?`, [`%${code}%`, `%${code}%`], function() {
                totalUpdated += this.changes || 0;
            });
        });
    });

    function checkDone() {
        completedCount++;
        if (completedCount >= cleanedCodes.length) {
            return res.json({ success: true, message: `Expedientes procesados. Documentos actualizados: ${totalUpdated}` });
        }
    }
});

// Marcar IDs de documentos o expedientes específicos como Cargado y Verificado Manualmente OK
router.post('/mark-documents-cargado', requireAuth, (req, res) => {
    const { document_ids, expediente_ids } = req.body;
    
    if (Array.isArray(document_ids) && document_ids.length > 0) {
        const placeholders = document_ids.map(() => '?').join(',');
        const sql = `UPDATE documents SET status = 'Cargado', load_date = COALESCE(load_date, NOW()), onbase_verified = 2, onbase_verify_stage = 'Verificado Manualmente OK ✅', onbase_verified_at = NOW() WHERE id IN (${placeholders})`;
        db.run(sql, document_ids, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ success: true, count: this.changes || 0, message: `${this.changes || 0} documento(s) marcados como Cargado y OK en AES` });
        });
    } else if (Array.isArray(expediente_ids) && expediente_ids.length > 0) {
        const placeholders = expediente_ids.map(() => '?').join(',');
        const sql = `UPDATE documents SET status = 'Cargado', load_date = COALESCE(load_date, NOW()), onbase_verified = 2, onbase_verify_stage = 'Verificado Manualmente OK ✅', onbase_verified_at = NOW() WHERE expediente_id IN (${placeholders})`;
        db.run(sql, expediente_ids, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ success: true, count: this.changes || 0, message: `Documentos del expediente marcados como Cargado y OK en AES` });
        });
    } else {
        return res.status(400).json({ error: 'Se requieren document_ids o expediente_ids' });
    }
});

// Endpoint para la pestaña "Verificador" manual: Dar OK o pasar a Pendiente documentos/expedientes
router.post('/manual-verify', requireAuth, (req, res) => {
    const { action = 'ok', document_ids = [], expediente_ids = [] } = req.body || {};
    const isOk = action === 'ok';

    if (Array.isArray(document_ids) && document_ids.length > 0) {
        const placeholders = document_ids.map(() => '?').join(',');
        const sql = isOk
            ? `UPDATE documents SET status = 'Cargado', load_date = COALESCE(load_date, NOW()), onbase_verified = 2, onbase_verify_stage = 'Verificado Manualmente OK ✅', onbase_verified_at = NOW() WHERE id IN (${placeholders})`
            : `UPDATE documents SET status = 'Pendiente', load_date = NULL, onbase_verified = 0, onbase_verify_stage = NULL, onbase_verified_at = NULL WHERE id IN (${placeholders})`;
        db.run(sql, document_ids, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({
                success: true,
                count: this.changes || document_ids.length,
                message: isOk
                    ? `✅ ${document_ids.length} documento(s) aprobados con OK.`
                    : `↩️ ${document_ids.length} documento(s) devueltos a Pendiente para cargue.`
            });
        });
    } else if (Array.isArray(expediente_ids) && expediente_ids.length > 0) {
        const placeholders = expediente_ids.map(() => '?').join(',');
        const sql = isOk
            ? `UPDATE documents SET status = 'Cargado', load_date = COALESCE(load_date, NOW()), onbase_verified = 2, onbase_verify_stage = 'Verificado Manualmente OK ✅', onbase_verified_at = NOW() WHERE expediente_id IN (${placeholders})`
            : `UPDATE documents SET status = 'Pendiente', load_date = NULL, onbase_verified = 0, onbase_verify_stage = NULL, onbase_verified_at = NULL WHERE expediente_id IN (${placeholders})`;
        db.run(sql, expediente_ids, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({
                success: true,
                count: this.changes || 0,
                message: isOk
                    ? `✅ Todos los documentos del expediente aprobados con OK.`
                    : `↩️ Documentos del expediente devueltos a Pendiente.`
            });
        });
    } else {
        return res.status(400).json({ error: 'Seleccione al menos un documento o expediente.' });
    }
});

// Actualizar tipología de un documento desde Cargue AES (con renombrado físico seguro si existe el archivo)
router.post('/update-typology', requireAuth, (req, res) => {
    const { id, typology_name } = req.body;
    if (!id || !typology_name || !String(typology_name).trim()) {
        return res.status(400).json({ error: 'Se requiere id y typology_name válidos.' });
    }
    const cleanTypology = String(typology_name).trim();

    db.get("SELECT d.*, e.subserie FROM documents d LEFT JOIN expedientes e ON d.expediente_id = e.id WHERE d.id = ?", [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Documento no encontrado' });

        // Buscar onbase_name y orden en trd_typologies
        const normTyp = cleanTypology.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        db.all("SELECT id, typology_name, onbase_name, series_id, subseries_id FROM trd_typologies ORDER BY id ASC", [], (tErr, typRows) => {
            let matchedOnbase = null;
            let trdOrder = null;

            if (!tErr && Array.isArray(typRows)) {
                const groupCounters = {};
                for (const r of typRows) {
                    const gKey = r.subseries_id ? `sub_${r.subseries_id}` : `ser_${r.series_id}`;
                    groupCounters[gKey] = (groupCounters[gKey] || 0) + 1;
                    const rNorm = String(r.typology_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
                    if (rNorm === normTyp) {
                        matchedOnbase = r.onbase_name || matchedOnbase;
                        if (trdOrder === null) trdOrder = groupCounters[gKey];
                    }
                }
            }

            const validOldPath = resolveDocumentPath(doc.path, doc.filename);
            let finalFilename = doc.filename;
            let finalPath = validOldPath || doc.path;

            // Intentar renombrar físicamente el archivo en su carpeta si existe en disco
            if (validOldPath && fs.existsSync(validOldPath)) {
                try {
                    const ext = path.extname(validOldPath) || '.pdf';
                    const safeName = cleanTypology
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-zA-Z0-9\s-_]/g, '')
                        .trim()
                        .replace(/\s+/g, '_');
                    const prefixMatch = String(doc.filename || '').match(/^(\d{2})_/);
                    const paddedOrder = trdOrder ? String(trdOrder).padStart(2, '0') : (prefixMatch ? prefixMatch[1] : '99');
                    const candidateFilename = `${paddedOrder}_${safeName}${ext}`;
                    const candidatePath = path.join(path.dirname(validOldPath), candidateFilename);

                    if (candidatePath !== validOldPath && !fs.existsSync(candidatePath)) {
                        fs.renameSync(validOldPath, candidatePath);
                        finalFilename = candidateFilename;
                        finalPath = candidatePath;
                    } else if (candidatePath === validOldPath) {
                        finalFilename = candidateFilename;
                        finalPath = candidatePath;
                    }
                } catch (renErr) {
                    console.warn(`[UPDATE-TYPOLOGY] No se renombró archivo físico (${renErr.message}), se conserva nombre físico original.`);
                }
            }

            db.run(
                "UPDATE documents SET typology_name = ?, filename = ?, path = ? WHERE id = ?",
                [cleanTypology, finalFilename, finalPath, id],
                function (uErr) {
                    if (uErr) return res.status(500).json({ error: uErr.message });
                    return res.json({
                        success: true,
                        message: 'Tipología actualizada correctamente',
                        id,
                        typology_name: cleanTypology,
                        onbase_name: matchedOnbase,
                        filename: finalFilename,
                        path: finalPath
                    });
                }
            );
        });
    });
});

module.exports = router;
