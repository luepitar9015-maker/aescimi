const express = require('express');
const router = express.Router();
const db = require('../database');
const { pool } = require('../database_pg');
const { requireAuth, requireSuperAdmin } = require('../middleware/authMiddleware');
const xlsx = require('xlsx');

// Whitelist of tables that can be accessed via the generic superuser API
const ALLOWED_TABLES = [
    'users', 'expedientes', 'documents', 'organization_structure',
    'trd_series', 'trd_subseries', 'trd_typologies',
    'user_trd_permissions', 'system_settings'
];

const validateTable = (name, res) => {
    if (!ALLOWED_TABLES.includes(name)) {
        res.status(400).json({ error: `Tabla '${name}' no permitida.` });
        return false;
    }
    return true;
};

// Apply requireAuth + requireSuperAdmin to ALL routes in this router
router.use(requireAuth, requireSuperAdmin);

// List all allowed tables
router.get('/tables', (req, res) => {
    // Return only the whitelisted tables (safer than querying information_schema)
    res.json(ALLOWED_TABLES);
});

// Get table data (read-only, whitelisted table names)
router.get('/table/:name', (req, res) => {
    const tableName = req.params.name;
    if (!validateTable(tableName, res)) return;

    // Table name is from whitelist, safe to interpolate
    pool.query(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`, (err, result) => {
        if (err) {
            console.error('[SUPERUSER] DB error on table read:', err);
            return res.status(500).json({ error: 'Error al consultar la tabla.' });
        }
        res.json({
            columns: result.fields.map(f => f.name),
            rows: result.rows
        });
    });
});

// Generic Delete (whitelisted table)
router.delete('/table/:name/:id', (req, res) => {
    const { name, id } = req.params;
    if (!validateTable(name, res)) return;

    // Validate id is a number to prevent injection
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    pool.query(`DELETE FROM ${name} WHERE id = $1`, [numericId], (err) => {
        if (err) {
            console.error('[SUPERUSER] DB error on delete:', err);
            return res.status(500).json({ error: 'Error al eliminar el registro.' });
        }
        res.json({ message: 'Registro eliminado' });
    });
});

// Generic Update (whitelisted table, validated columns against actual schema)
router.put('/table/:name/:id', async (req, res) => {
    const { name, id } = req.params;
    if (!validateTable(name, res)) return;

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    const body = { ...req.body };
    delete body.id; // Don't update ID

    if (Object.keys(body).length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    try {
        // Fetch actual column names from the DB to validate field names
        const schemaResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
            [name]
        );
        const validColumns = new Set(schemaResult.rows.map(r => r.column_name));

        const keys = Object.keys(body).filter(k => validColumns.has(k));
        if (keys.length === 0) {
            return res.status(400).json({ error: 'Ningún campo válido para actualizar.' });
        }

        const values = keys.map(k => body[k]);
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        pool.query(`UPDATE ${name} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, numericId], (err) => {
            if (err) {
                console.error('[SUPERUSER] DB error on update:', err);
                return res.status(500).json({ error: 'Error al actualizar el registro.' });
            }
            res.json({ message: 'Registro actualizado' });
        });
    } catch (err) {
        console.error('[SUPERUSER] Error validating schema:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// ELIMINACIÓN MASIVA DE EXPEDIENTES (solo superadmin)
// ──────────────────────────────────────────────────────────────────────────────

// POST /api/superuser/limpiar-expedientes
// Elimina TODOS los expedientes + documentos y reinicia secuencias de IDs
router.post('/limpiar-expedientes', async (req, res) => {
    const { confirmacion } = req.body;
    if (confirmacion !== 'ELIMINAR') {
        return res.status(400).json({ error: 'Confirmación incorrecta. Se requiere: ELIMINAR' });
    }

    try {
        // Contar antes de eliminar
        const cntDocs = await pool.query('SELECT COUNT(*) AS total FROM documents');
        const cntExp  = await pool.query('SELECT COUNT(*) AS total FROM expedientes');

        const totalDocs = parseInt(cntDocs.rows[0].total, 10);
        const totalExp  = parseInt(cntExp.rows[0].total, 10);

        // Eliminar (documentos primero por dependencias FK)
        await pool.query('DELETE FROM documents');
        await pool.query('DELETE FROM expedientes');

        // Reiniciar secuencias a 1
        await pool.query("SELECT setval('documents_id_seq',  1, false)");
        await pool.query("SELECT setval('expedientes_id_seq', 1, false)");

        console.log(`[SUPERUSER] Limpieza masiva ejecutada por usuario ${req.user?.id}: ${totalExp} expedientes, ${totalDocs} documentos eliminados.`);

        res.json({
            message: 'Limpieza completada exitosamente.',
            eliminados: {
                expedientes: totalExp,
                documentos: totalDocs
            }
        });
    } catch (err) {
        console.error('[SUPERUSER] Error en limpieza masiva:', err);
        res.status(500).json({ error: 'Error al ejecutar la limpieza: ' + err.message });
    }
});

// Update Expiration Date
router.post('/set-expiration', (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ error: 'Fecha requerida.' });
    }

    pool.query(
        "UPDATE system_settings SET value = $1 WHERE key = 'system_expiration_date'",
        [date],
        (err) => {
            if (err) {
                console.error('[SUPERUSER] Error setting expiration:', err);
                return res.status(500).json({ error: 'Error al actualizar la fecha de caducidad.' });
            }
            res.json({ message: 'Fecha de caducidad actualizada' });
        }
    );
});

// ──────────────────────────────────────────────────────────────────────────────
// EXPLORADOR DE ARCHIVOS
// ──────────────────────────────────────────────────────────────────────────────
const fs      = require('fs');
const path    = require('path');
const archiver = require('archiver');
const db_main  = require('../database'); // para leer storage_path de settings

/** Obtiene la ruta raíz del almacenamiento desde system_settings o por defecto */
const getStoragePath = () => new Promise((resolve) => {
    if (process.env.LOCAL_STORAGE_PATH) {
        return resolve(process.env.LOCAL_STORAGE_PATH);
    }
    db_main.get("SELECT value FROM system_settings WHERE key = 'storage_path'", [], (err, row) => {
        resolve(row?.value || path.join(__dirname, '../uploads/Gestion_Documental'));
    });
});

/** Construye un árbol de nodos a partir de un directorio */
const buildTree = (dir, relativeTo) => {
    let items = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath  = path.join(dir, entry.name);
            const relPath   = path.relative(relativeTo, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                items.push({
                    type: 'folder',
                    name: entry.name,
                    path: relPath,
                    children: buildTree(fullPath, relativeTo),
                });
            } else {
                const stat = fs.statSync(fullPath);
                items.push({
                    type: 'file',
                    name: entry.name,
                    path: relPath,
                    size: stat.size,
                    modified: stat.mtime,
                    ext: path.extname(entry.name).toLowerCase().replace('.', ''),
                });
            }
        }
    } catch (_) { /* carpeta inaccesible */ }
    return items;
};

// GET /api/superuser/files — lista el árbol completo o subdirectorio
router.get('/files', async (req, res) => {
    try {
        const root    = await getStoragePath();
        const subdir  = req.query.path ? path.join(root, req.query.path) : root;

        // Seguridad: evitar path traversal
        if (!subdir.startsWith(root)) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        if (!fs.existsSync(subdir)) {
            return res.json({ items: [], root: '', storageRoot: root });
        }

        const items = buildTree(subdir, root);
        res.json({ items, root: req.query.path || '', storageRoot: root });
    } catch (err) {
        console.error('[EXPLORADOR] Error:', err);
        res.status(500).json({ error: 'Error al listar archivos.' });
    }
});

// GET /api/superuser/files/download?path=rel/path/to/file — descarga un archivo
router.get('/files/download', async (req, res) => {
    try {
        const root    = await getStoragePath();
        const relPath = req.query.path;
        if (!relPath) return res.status(400).json({ error: 'Path requerido.' });

        const fullPath = path.join(root, relPath);
        if (!fullPath.startsWith(root)) return res.status(403).json({ error: 'Acceso denegado.' });
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Archivo no encontrado.' });

        res.download(fullPath);
    } catch (err) {
        res.status(500).json({ error: 'Error al descargar archivo.' });
    }
});

// POST /api/superuser/files/zip — descarga una selección de archivos/carpetas como ZIP
// Body: { paths: ['rel/path1', 'rel/folder2', ...], zipName: 'mi_descarga' }
router.post('/files/zip', async (req, res) => {
    try {
        const root    = await getStoragePath();
        const { paths = [], zipName = 'documentos' } = req.body;

        if (!Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un archivo o carpeta.' });
        }

        // Validar todos los paths antes de empacar
        const resolved = paths.map(p => {
            const full = path.join(root, p);
            if (!full.startsWith(root)) throw new Error(`Path inválido: ${p}`);
            return { rel: p, full };
        });

        const safeName = zipName.replace(/[^a-zA-Z0-9_\-]/g, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('error', err => { console.error('[ZIP]', err); });
        archive.pipe(res);

        for (const { rel, full } of resolved) {
            if (!fs.existsSync(full)) continue;
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                archive.directory(full, rel);
            } else {
                archive.file(full, { name: rel });
            }
        }

        await archive.finalize();
    } catch (err) {
        console.error('[EXPLORADOR/ZIP] Error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message || 'Error al comprimir.' });
    }
});

// GET /api/superuser/online-users
router.get('/online-users', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, role, area, position, last_activity, is_active 
             FROM users 
             ORDER BY last_activity DESC NULLS LAST, full_name`
        );
        const users = result.rows.map(user => {
            let isOnline = false;
            if (user.last_activity) {
                const diffMs = Date.now() - new Date(user.last_activity).getTime();
                if (diffMs < 300000) { // 5 minutos
                    isOnline = true;
                }
            }
            return {
                ...user,
                is_online: isOnline
            };
        });
        res.json({ data: users });
    } catch (err) {
        console.error('[SUPERUSER] Error fetching online users:', err);
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
});

// GET /api/superuser/audit-logs
router.get('/audit-logs', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, user_name, user_role, action, details, ip_address, created_at 
             FROM audit_logs 
             ORDER BY created_at DESC 
             LIMIT 500`
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[SUPERUSER] Error fetching audit logs:', err);
        res.status(500).json({ error: 'Error al obtener bitácora de auditoría.' });
    }
});

// GET /api/superuser/reports/aes-loaded
router.get('/reports/aes-loaded', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD format
    try {
        let query = '';
        const params = [];
        
        if (date && date.trim() !== '') {
            query = `
                SELECT 
                    e.expediente_code AS "Código Expediente",
                    e.title AS "Título Expediente",
                    e.subserie AS "Subserie",
                    e.box_id AS "Caja",
                    e.regional AS "Regional",
                    e.centro AS "Centro",
                    e.dependencia AS "Dependencia",
                    e.storage_type AS "Tipo Almacenamiento",
                    TO_CHAR(e.opening_date, 'YYYY-MM-DD') AS "Fecha Apertura",
                    'SÍ' AS "Cargado en AES",
                    TO_CHAR(MAX(d.load_date), 'YYYY-MM-DD HH24:MI:SS') AS "Fecha de Cargue",
                    COUNT(CASE WHEN d.status = 'Cargado' THEN 1 END) AS "Documentos Cargados",
                    (SELECT COUNT(*) FROM documents d2 WHERE d2.expediente_id = e.id) AS "Total Documentos",
                    COALESCE(STRING_AGG(DISTINCT d.ades_id, ', '), '') AS "IDs AES",
                    (
                        SELECT STRING_AGG(u.full_name, ', ')
                        FROM expediente_assignments ea
                        JOIN users u ON ea.user_id = u.id
                        WHERE ea.expediente_id = e.id
                    ) AS "Responsable(s)"
                FROM expedientes e
                INNER JOIN documents d ON d.expediente_id = e.id
                WHERE d.status = 'Cargado'
                  AND TO_CHAR(d.load_date, 'YYYY-MM-DD') = $1
                GROUP BY e.id, e.expediente_code, e.title, e.subserie, e.box_id, e.regional, e.centro, e.dependencia, e.storage_type, e.opening_date
                ORDER BY "Fecha de Cargue" DESC, e.id DESC
            `;
            params.push(date.trim());
        } else {
            query = `
                SELECT 
                    e.expediente_code AS "Código Expediente",
                    e.title AS "Título Expediente",
                    e.subserie AS "Subserie",
                    e.box_id AS "Caja",
                    e.regional AS "Regional",
                    e.centro AS "Centro",
                    e.dependencia AS "Dependencia",
                    e.storage_type AS "Tipo Almacenamiento",
                    TO_CHAR(e.opening_date, 'YYYY-MM-DD') AS "Fecha Apertura",
                    CASE 
                        WHEN COUNT(CASE WHEN d.status = 'Cargado' THEN 1 END) > 0 THEN 'SÍ' 
                        ELSE 'NO' 
                    END AS "Cargado en AES",
                    COALESCE(TO_CHAR(MAX(d.load_date), 'YYYY-MM-DD HH24:MI:SS'), '') AS "Fecha de Cargue",
                    COUNT(CASE WHEN d.status = 'Cargado' THEN 1 END) AS "Documentos Cargados",
                    COUNT(d.id) AS "Total Documentos",
                    COALESCE(STRING_AGG(DISTINCT d.ades_id, ', '), '') AS "IDs AES",
                    (
                        SELECT STRING_AGG(u.full_name, ', ')
                        FROM expediente_assignments ea
                        JOIN users u ON ea.user_id = u.id
                        WHERE ea.expediente_id = e.id
                    ) AS "Responsable(s)"
                FROM expedientes e
                LEFT JOIN documents d ON d.expediente_id = e.id
                GROUP BY e.id, e.expediente_code, e.title, e.subserie, e.box_id, e.regional, e.centro, e.dependencia, e.storage_type, e.opening_date
                ORDER BY "Cargado en AES" DESC, "Fecha de Cargue" DESC NULLS LAST, e.id DESC
            `;
        }

        const result = await pool.query(query, params);
        
        // Generate Workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(result.rows);
        
        // Auto column widths
        if (result.rows.length > 0) {
            const keys = Object.keys(result.rows[0]);
            ws['!cols'] = keys.map(key => {
                const maxLen = Math.max(
                    key.length,
                    ...result.rows.map(row => String(row[key] || '').length)
                );
                return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
            });
        }
        
        xlsx.utils.book_append_sheet(wb, ws, 'AES Cargados');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        const filename = date ? `Reporte_AES_Cargados_${date}.xlsx` : 'Reporte_AES_Cargados_Todos.xlsx';
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('[SUPERUSER] Error generating loaded AES report:', err);
        res.status(500).json({ error: 'Error al generar el reporte de cargados en AES.' });
    }
});

// GET /api/superuser/reports/no-code-documents
router.get('/reports/no-code-documents', async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id,
                e.box_id,
                TO_CHAR(e.opening_date, 'YYYY-MM-DD') AS opening_date,
                e.subserie,
                e.storage_type,
                e.title,
                e.metadata_values,
                (
                    SELECT STRING_AGG(u.full_name, ', ')
                    FROM expediente_assignments ea
                    JOIN users u ON ea.user_id = u.id
                    WHERE ea.expediente_id = e.id
                ) AS responsable
            FROM expedientes e
            WHERE (e.expediente_code IS NULL OR TRIM(e.expediente_code) = '' OR e.expediente_code = 'Sin Código')
              AND EXISTS (
                  SELECT 1 FROM documents d 
                  WHERE d.expediente_id = e.id
              )
            ORDER BY e.created_at DESC
        `;

        const result = await pool.query(query);
        
        // Map to regional template format
        const reportRows = result.rows.map(row => {
            let meta = {};
            if (row.metadata_values) {
                try {
                    meta = typeof row.metadata_values === 'string' 
                        ? JSON.parse(row.metadata_values) 
                        : row.metadata_values;
                } catch (e) {
                    console.error('Error parsing metadata_values for row', row.id, e);
                }
            }
            
            return {
                'Codigo Expediente': '',
                'Id Caja': row.box_id || '',
                'Fecha Apertura': row.opening_date || '',
                'Subserie': row.subserie || '',
                'Tipo Almacenamiento': row.storage_type || '',
                'Titulo': row.title || '',
                'Responsable': row.responsable || '',
                'Valor 1': meta.valor1 || '',
                'Valor 2': meta.valor2 || '',
                'Valor 3': meta.valor3 || '',
                'Valor 4': meta.valor4 || '',
                'Valor 5': meta.valor5 || '',
                'Valor 6': meta.valor6 || '',
                'Valor 7': meta.valor7 || '',
                'Valor 8': meta.valor8 || ''
            };
        });
        
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(reportRows);
        
        // Auto column widths
        const headers = [
            'Codigo Expediente', 'Id Caja', 'Fecha Apertura', 'Subserie', 'Tipo Almacenamiento',
            'Titulo', 'Responsable', 'Valor 1', 'Valor 2', 'Valor 3', 'Valor 4', 'Valor 5',
            'Valor 6', 'Valor 7', 'Valor 8'
        ];
        ws['!cols'] = headers.map(key => {
            const maxLen = Math.max(
                key.length,
                ...reportRows.map(row => String(row[key] || '').length)
            );
            return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
        });
        
        xlsx.utils.book_append_sheet(wb, ws, 'Plantilla_Expedientes');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="Expedientes_Sin_Codigo_Para_Regional.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('[SUPERUSER] Error generating no code report:', err);
        res.status(500).json({ error: 'Error al generar el reporte de expedientes sin código.' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// MONITOREO DE SERVIDOR Y SISTEMA (SOLO SUPERADMIN)
// ──────────────────────────────────────────────────────────────────────────────
const os = require('os');
const net = require('net');
const { exec } = require('child_process');

const execPromise = (cmd) => new Promise((resolve) => {
    exec(cmd, { timeout: 6000 }, (error, stdout, stderr) => {
        resolve({ error, stdout: stdout || '', stderr: stderr || '' });
    });
});

// GET /api/superuser/server-status
router.get('/server-status', async (req, res) => {
    try {
        // 1. Métricas de Sistema Operativo
        const cpus = os.cpus();
        const cpuCount = cpus.length;
        const cpuModel = cpus[0]?.model || 'N/A';
        const loadAvg = os.loadavg(); // [1m, 5m, 15m]
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const uptimeSeconds = os.uptime();
        const hostname = os.hostname();
        const platform = os.platform();
        const release = os.release();

        // 2. Espacio en Disco (df -h en Linux o wmic en Windows)
        let diskInfo = [];
        if (platform === 'linux') {
            const { stdout: dfOut } = await execPromise("df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null || df -h");
            const lines = dfOut.trim().split('\n');
            if (lines.length > 1) {
                diskInfo = lines.slice(1).map(l => {
                    const parts = l.trim().split(/\s+/);
                    return {
                        filesystem: parts[0] || '',
                        size: parts[1] || '',
                        used: parts[2] || '',
                        avail: parts[3] || '',
                        usePercent: parts[4] || '',
                        mount: parts[5] || parts[parts.length - 1] || ''
                    };
                }).filter(d => d.size);
            }
        }

        // 3. Procesos PM2
        let pm2Processes = [];
        try {
            const { stdout: pm2Out } = await execPromise('pm2 jlist 2>/dev/null');
            if (pm2Out && pm2Out.trim().startsWith('[')) {
                const list = JSON.parse(pm2Out.trim());
                pm2Processes = list.map(p => ({
                    id: p.pm_id,
                    name: p.name,
                    status: p.pm2_env?.status || 'unknown',
                    cpu: p.monit?.cpu || 0,
                    memory: p.monit?.memory ? (p.monit.memory / (1024 * 1024)).toFixed(1) + ' MB' : '0 MB',
                    uptime: p.pm2_env?.pm_uptime ? Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
                    restarts: p.pm2_env?.restart_time || 0
                }));
            }
        } catch { }

        // 4. Diagnóstico de Servicios Esenciales
        const services = [];

        // Base de Datos PostgreSQL
        let dbOk = false;
        let dbVersion = 'N/A';
        let dbConnections = 0;
        let dbSize = 'N/A';
        try {
            const dbCheck = await pool.query(`
                SELECT version(), 
                       (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_conns,
                       pg_size_pretty(pg_database_size(current_database())) as dbsize
            `);
            if (dbCheck.rows.length > 0) {
                dbOk = true;
                dbVersion = dbCheck.rows[0].version?.split(' ')?.[1] || 'PostgreSQL';
                dbConnections = parseInt(dbCheck.rows[0].active_conns, 10);
                dbSize = dbCheck.rows[0].dbsize;
            }
        } catch (dbErr) {
            console.error('[SERVER STATUS] DB check error:', dbErr.message);
        }
        services.push({
            name: 'PostgreSQL Database',
            status: dbOk ? 'healthy' : 'down',
            details: dbOk ? `Activa (${dbConnections} conexiones, tamaño: ${dbSize})` : 'Sin conexión'
        });

        // 4b. Servidor Web HTTP (Puerto 80 / Reverse Proxy)
        let isHttpActive = false;
        let httpTech = 'Express / Node.js';

        // Probar conectividad socket TCP en puerto 80 local (timeout 1.5s)
        try {
            await new Promise((resolve, reject) => {
                const client = net.createConnection({ port: 80, host: '127.0.0.1' }, () => {
                    isHttpActive = true;
                    client.end();
                    resolve();
                });
                client.setTimeout(1500);
                client.on('timeout', () => { client.destroy(); reject(new Error('Timeout')); });
                client.on('error', (err) => { reject(err); });
            });
        } catch {
            isHttpActive = false;
        }

        // Si no respondió puerto 80, probar puerto 3000 o 3005
        if (!isHttpActive) {
            try {
                await new Promise((resolve, reject) => {
                    const client = net.createConnection({ port: 3000, host: '127.0.0.1' }, () => {
                        isHttpActive = true;
                        client.end();
                        resolve();
                    });
                    client.setTimeout(1000);
                    client.on('timeout', () => { client.destroy(); reject(new Error('Timeout')); });
                    client.on('error', (err) => { reject(err); });
                });
            } catch {}
        }

        // En Linux, verificar si Nginx o Apache están activos como proxy inverso
        if (platform === 'linux') {
            try {
                const { stdout: srvCheck } = await execPromise('systemctl is-active nginx 2>/dev/null || systemctl is-active openresty 2>/dev/null || systemctl is-active httpd 2>/dev/null');
                if (srvCheck.trim() === 'active') {
                    httpTech = 'Nginx';
                    isHttpActive = true;
                }
            } catch {}
        }

        services.push({
            name: 'Servidor Web HTTP (Puerto 80)',
            status: isHttpActive ? 'healthy' : 'down',
            details: isHttpActive 
                ? `Operativo y respondiendo peticiones HTTP (${httpTech})` 
                : 'Inactivo o puerto 80 no responde'
        });

        // 4c. Motor de Aplicación (PM2 Cluster)
        const onlineProcesses = pm2Processes.filter(p => p.status === 'online');
        if (pm2Processes.length > 0) {
            services.push({
                name: 'Motor de Aplicación (PM2)',
                status: onlineProcesses.length > 0 ? 'healthy' : 'down',
                details: onlineProcesses.length > 0 
                    ? `Activo (${onlineProcesses.length} servicios en línea: ${onlineProcesses.map(p => p.name).join(', ')})`
                    : 'Procesos detenidos'
            });
        }

        // 5. Estadísticas Generales del Sistema Documental
        let totalExpedientes = 0;
        let totalDocumentos = 0;
        let docsCargados = 0;
        let docsPendientes = 0;
        let totalUsuarios = 0;
        try {
            const expCount = await pool.query('SELECT COUNT(*) FROM expedientes');
            totalExpedientes = parseInt(expCount.rows[0]?.count || 0, 10);

            const docCount = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'Cargado' THEN 1 END) as cargados,
                    COUNT(CASE WHEN status != 'Cargado' OR status IS NULL THEN 1 END) as pendientes
                FROM documents
            `);
            totalDocumentos = parseInt(docCount.rows[0]?.total || 0, 10);
            docsCargados = parseInt(docCount.rows[0]?.cargados || 0, 10);
            docsPendientes = parseInt(docCount.rows[0]?.pendientes || 0, 10);

            const userCount = await pool.query('SELECT COUNT(*) FROM users');
            totalUsuarios = parseInt(userCount.rows[0]?.count || 0, 10);
        } catch { }

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            os: {
                hostname,
                platform,
                release,
                cpuCount,
                cpuModel,
                loadAvg,
                totalMemMB: Math.round(totalMem / (1024 * 1024)),
                usedMemMB: Math.round(usedMem / (1024 * 1024)),
                freeMemMB: Math.round(freeMem / (1024 * 1024)),
                memPercent: Math.round((usedMem / totalMem) * 100),
                uptimeSeconds
            },
            disks: diskInfo,
            pm2: pm2Processes,
            services,
            stats: {
                totalExpedientes,
                totalDocumentos,
                docsCargados,
                docsPendientes,
                totalUsuarios
            }
        });

    } catch (err) {
        console.error('[SUPERUSER] Error obteniendo server-status:', err);
        res.status(500).json({ error: 'Error al consultar estado del servidor: ' + err.message });
    }
});

// POST /api/superuser/server-action
// Ejecuta acciones de mantenimiento controladas (reiniciar proceso backend, liberar memoria, etc.)
router.post('/server-action', async (req, res) => {
    const { action, target } = req.body;
    console.log(`[SUPERUSER] Acción de servidor solicitada por ${req.user?.id}: ${action} (target: ${target})`);

    try {
        if (action === 'restart_process') {
            const procName = target === 'sena-presentacion' ? 'sena-presentacion' : 'sena-backend';
            // Responder antes del restart si es el mismo proceso
            res.json({ success: true, message: `Reinicio de ${procName} ejecutado.` });
            setTimeout(() => {
                exec(`pm2 restart ${procName}`);
            }, 500);
            return;
        }

        if (action === 'flush_pm2_logs') {
            await execPromise('pm2 flush');
            return res.json({ success: true, message: 'Logs de PM2 vaciados correctamente.' });
        }

        if (action === 'vacuum_db') {
            await pool.query('VACUUM ANALYZE;');
            return res.json({ success: true, message: 'Optimización de Base de Datos (VACUUM ANALYZE) ejecutada con éxito.' });
        }

        return res.status(400).json({ error: 'Acción no reconocida.' });
    } catch (err) {
        console.error('[SUPERUSER] Error ejecutando acción de servidor:', err);
        res.status(500).json({ error: 'Fallo al ejecutar acción: ' + err.message });
    }
});

module.exports = router;


