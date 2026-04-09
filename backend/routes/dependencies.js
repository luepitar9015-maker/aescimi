const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all dependencies
router.get('/', (req, res) => {
    db.all("SELECT * FROM dependencies", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// CREATE dependency
router.post('/', (req, res) => {
    const { code, name } = req.body;
    const stmt = db.prepare("INSERT INTO dependencies (code, name) VALUES (?, ?)");
    stmt.run(code, name, function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, code, name });
    });
    stmt.finalize();
});

// DELETE dependency
router.delete('/:id', (req, res) => {
    db.run("DELETE FROM dependencies WHERE id = ?", req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Deleted", changes: this.changes });
    });
});

module.exports = router;
