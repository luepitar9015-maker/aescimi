const express = require('express');
const router = express.Router();
const db = require('../database');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Helper to ensure directory exists
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// UPDATE Metadata Schema for Series/Subseries
router.post('/schema/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const { fields } = req.body; // Array of field objects { name, type }
    const schemaStr = JSON.stringify(fields);

    const table = type === 'series' ? 'trd_series' : 'trd_subseries';

    // First, get the storage_path to ensure folder exists
    db.get(`SELECT storage_path FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Create folder if storage_path exists
        if (row && row.storage_path) {
            try {
                ensureDir(row.storage_path);
                console.log(`Folder ensured: ${row.storage_path}`);
            } catch (fsErr) {
                console.error('Error creating folder:', fsErr);
                return res.status(500).json({ error: 'Failed to create folder: ' + fsErr.message });
            }
        }

        // Update the schema
        db.run(`UPDATE ${table} SET metadata_schema = ? WHERE id = ?`, [schemaStr, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                message: 'Schema updated and folder created',
                path: row ? row.storage_path : null
            });
        });
    });
});

// GET Metadata Schema
router.get('/schema/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const table = type === 'series' ? 'trd_series' : 'trd_subseries';

    db.get(`SELECT metadata_schema FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ schema: row ? JSON.parse(row.metadata_schema || '[]') : [] });
    });
});

// GENERATE Excel Template
router.get('/template/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const table = type === 'series' ? 'trd_series' : 'trd_subseries';

    db.get(`SELECT metadata_schema FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const fields = row ? JSON.parse(row.metadata_schema || '[]') : [];
        const headers = fields.map(f => {
            if (f.type === 'select' && f.options) {
                return `${f.name} (Lista: ${f.options})`;
            }
            return f.name;
        });
        // Add default required headers
        headers.unshift('FILENAME'); // Suggested filename or auto-match

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet([headers]);
        xlsx.utils.book_append_sheet(wb, ws, "Template");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.attachment(`Template_${type}_${id}.xlsx`);
        res.send(buffer);
    });
});

// MASS UPLOAD (Requires Multer middleware in server.js to pass file)
router.post('/upload/:type/:id', (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { type, id } = req.params;

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Get the parent storage path and metadata schema
        const table = type === 'series' ? 'trd_series' : 'trd_subseries';

        db.get(`SELECT storage_path, metadata_schema FROM ${table} WHERE id = ?`, [id], (err, parent) => {
            if (err || !parent) {
                return res.status(400).json({ error: 'Parent not found' });
            }

            const parentPath = parent.storage_path;
            const schema = JSON.parse(parent.metadata_schema || '[]');

            // Prepare statement for inserting documents
            const stmt = db.prepare("INSERT INTO documents (typology_id, series_id, subseries_id, filename, path, metadata_values) VALUES (?, ?, ?, ?, ?, ?)");

            let processedCount = 0;
            let createdFolders = [];

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                data.forEach(row => {
                    // Build folder name from metadata values (excluding FILENAME)
                    const metadataValues = [];
                    schema.forEach(field => {
                        const value = row[field.name];
                        if (value && value !== '') {
                            // Clean the value for folder name (remove invalid characters)
                            const cleanValue = String(value).replace(/[<>:"/\\|?*]/g, '-');
                            metadataValues.push(cleanValue);
                        }
                    });

                    // Create folder name by joining metadata with underscores
                    const folderName = metadataValues.join('_') || 'Sin_Metadatos';
                    const folderPath = path.join(parentPath, folderName);

                    // Create the folder
                    try {
                        ensureDir(folderPath);
                        createdFolders.push(folderPath);
                        console.log(`Created folder: ${folderPath}`);
                    } catch (fsErr) {
                        console.error(`Error creating folder ${folderPath}:`, fsErr);
                    }

                    // Store in database
                    const filename = row['FILENAME'] || 'Unknown';
                    const metadata = JSON.stringify(row);

                    let sId = type === 'series' ? id : null;
                    let subId = type === 'subseries' ? id : null;

                    stmt.run(null, sId, subId, filename, folderPath, metadata);
                    processedCount++;
                });

                db.run("COMMIT");
                stmt.finalize();

                res.json({
                    message: `Processed ${processedCount} records and created ${createdFolders.length} folders`,
                    folders: createdFolders
                });
            });
        });

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
