const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all organization entries
router.get('/', (req, res) => {
    db.all("SELECT * FROM organization_structure ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ data: rows });
    });
});

// POST new organization entry
router.post('/', (req, res) => {
    const { 
        entity_name, 
        regional_code, regional_name, 
        center_code, center_name, 
        section_code, section_name, 
        subsection_code, subsection_name 
    } = req.body;

    const sql = `INSERT INTO organization_structure (
        entity_name, 
        regional_code, regional_name, 
        center_code, center_name, 
        section_code, section_name, 
        subsection_code, subsection_name,
        storage_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        entity_name || 'SENA', 
        regional_code, regional_name, 
        center_code, center_name, 
        section_code, section_name, 
        subsection_code, subsection_name,
        req.body.storage_path || ''
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error("DEBUG [POST /organization] Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log("DEBUG [POST /organization] Created ID:", this.lastID);
        res.json({ 
            message: 'Organization structure created successfully', 
            id: this.lastID,
            data: req.body 
        });
    });
});

// UPDATE organization entry (Storage Path)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { storage_path } = req.body;

    db.run("UPDATE organization_structure SET storage_path = ? WHERE id = ?", [storage_path, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Updated successfully', changes: this.changes });
    });
});

// DELETE organization entry
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM organization_structure WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Deleted successfully', changes: this.changes });
    });
});

module.exports = router;
