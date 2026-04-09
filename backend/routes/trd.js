const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const BASE_DOCS_PATH = config.STORAGE_BASE_PATH;

// Helper to ensure directory exists
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// GET all Series
router.get('/series', (req, res) => {
    const sql = `
        SELECT s.*, d.name as dependency_name, d.code as dependency_code 
        FROM trd_series s 
        LEFT JOIN dependencies d ON s.dependency_id = d.id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// CREATE Series
router.post('/series', (req, res) => {
    const { code, name, type, center_code, dependency_id, storage_path } = req.body;

    // 1. Get Dependency Info to build path (if auto-pathing is desired)
    // For now, we respect the user provided storage_path OR build one if empty.

    db.get("SELECT * FROM dependencies WHERE id = ?", [dependency_id], (err, dep) => {
        if (err) return res.status(500).json({ error: "Db Error" });

        // Construct Path: Base / DepCode / SeriesCode
        let finalPath = storage_path;
        if (!finalPath && dep) {
            finalPath = path.join(BASE_DOCS_PATH, dep.code, `${code}-${name}`);
        } else if (!finalPath) {
            finalPath = path.join(BASE_DOCS_PATH, 'GENERAL', `${code}-${name}`);
        }

        // Create Folder
        try {
            ensureDir(finalPath);
        } catch (fsErr) {
            console.error("FS Error:", fsErr);
            return res.status(500).json({ error: "Failed to create directory: " + fsErr.message });
        }

        const sql = "INSERT INTO trd_series (code, name, type, center_code, dependency_id, storage_path) VALUES (?,?,?,?,?,?)";
        const params = [code, name, type, center_code, dependency_id, finalPath];

        db.run(sql, params, function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: 'Serie creada y carpeta generada', id: this.lastID, path: finalPath });
        });
    });
});

// GET Subseries by Series ID
router.get('/subseries', (req, res) => {
    const { series_id } = req.query; // Changed to query param for consistency or req.query
    if (!series_id) return res.status(400).json({ error: "series_id required" });

    db.all("SELECT * FROM trd_subseries WHERE series_id = ?", [series_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// CREATE Subseries
router.post('/subseries', (req, res) => {
    const { series_id, code, name } = req.body;

    // Get Parent Series Path
    db.get("SELECT storage_path FROM trd_series WHERE id = ?", [series_id], (err, series) => {
        if (err || !series) return res.status(400).json({ error: "Series not found" });

        const finalPath = path.join(series.storage_path, `${code}-${name}`);

        try {
            ensureDir(finalPath);
        } catch (fsErr) {
            return res.status(500).json({ error: "Failed to create directory" });
        }

        const sql = "INSERT INTO trd_subseries (series_id, code, name, storage_path) VALUES (?,?,?,?)";
        db.run(sql, [series_id, code, name, finalPath], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: 'Subserie creada y carpeta generada', id: this.lastID, path: finalPath });
        });
    });
});

// GET Typologies
router.get('/typologies/:parent_type/:parent_id', (req, res) => {
    const { parent_type, parent_id } = req.params;
    db.all("SELECT * FROM trd_typologies WHERE parent_type = ? AND parent_id = ? ORDER BY id ASC", [parent_type, parent_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// CREATE Typology
router.post('/typologies', (req, res) => {
    const { parent_id, parent_type, name } = req.body;
    console.log("Creating Typology:", req.body);
    const sql = "INSERT INTO trd_typologies (parent_id, parent_type, name) VALUES (?,?,?)";
    db.run(sql, [parent_id, parent_type, name], function (err) {
        if (err) {
            console.error("Error creating typology:", err.message);
            return res.status(400).json({ error: err.message });
        }
        console.log("Typology created with ID:", this.lastID);
        res.json({ message: 'Tipología creada', id: this.lastID });
    });
});

// EDIT Typology (Name)
router.put('/typologies/:id', (req, res) => {
    const { name } = req.body;
    db.run("UPDATE trd_typologies SET name = ? WHERE id = ?", [name, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipología actualizada' });
    });
});

// DELETE Typology
router.delete('/typologies/:id', (req, res) => {
    db.run("DELETE FROM trd_typologies WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipología eliminada' });
    });
});

// EDIT Series
router.put('/series/:id', (req, res) => {
    const { code, name } = req.body;
    db.run("UPDATE trd_series SET code = ?, name = ? WHERE id = ?", [code, name, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Serie actualizada' });
    });
});

// DELETE Series
router.delete('/series/:id', (req, res) => {
    db.run("DELETE FROM trd_series WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // Also delete children? For now, we assume simple delete.
        // Ideally we should cascade delete subseries/typologies but SQLite might handle if configured or we leave orphans.
        // Let's manually delete children to be clean.
        db.run("DELETE FROM trd_subseries WHERE series_id = ?", [req.params.id]);
        db.run("DELETE FROM trd_typologies WHERE parent_type = 'series' AND parent_id = ?", [req.params.id]);
        res.json({ message: 'Serie eliminada' });
    });
});

// EDIT Subseries
router.put('/subseries/:id', (req, res) => {
    const { code, name } = req.body;
    db.run("UPDATE trd_subseries SET code = ?, name = ? WHERE id = ?", [code, name, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Subserie actualizada' });
    });
});

// DELETE Subseries
router.delete('/subseries/:id', (req, res) => {
    db.run("DELETE FROM trd_subseries WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("DELETE FROM trd_typologies WHERE parent_type = 'subseries' AND parent_id = ?", [req.params.id]);
        res.json({ message: 'Subserie eliminada' });
    });
});

// GET all TRD (Series with Subseries)
router.get('/all', (req, res) => {
    const sql = `
        SELECT 
            s.id as series_id, s.series_code, s.series_name,
            sub.id as subseries_id, sub.subseries_code, sub.subseries_name
        FROM trd_series s
        LEFT JOIN trd_subseries sub ON s.id = sub.series_id
        ORDER BY s.series_code, sub.subseries_code
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Group by series
        const structured = rows.reduce((acc, row) => {
            let s = acc.find(item => item.id === row.series_id);
            if (!s) {
                s = { 
                    id: row.series_id, 
                    series_code: row.series_code, 
                    series_name: row.series_name, 
                    subseries: [] 
                };
                acc.push(s);
            }
            if (row.subseries_id) {
                s.subseries.push({
                    id: row.subseries_id,
                    subseries_code: row.subseries_code,
                    subseries_name: row.subseries_name
                });
            }
            return acc;
        }, []);

        res.json({ data: structured });
    });
});

module.exports = router;
