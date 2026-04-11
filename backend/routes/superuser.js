const express = require('express');
const router = express.Router();
const db = require('../database');
const { pool } = require('../database_pg');
const { requireAuth, requireSuperAdmin } = require('../middleware/authMiddleware');

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

module.exports = router;


