const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/temp/' });

// Upload PDF for preview
router.post('/upload-preview', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({
        message: 'File uploaded',
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path
    });
});

// Split PDF
router.post('/split', async (req, res) => {
    const { filePath, splits } = req.body;
    // splits = [{ startPage: 1, endPage: 2, name: 'Acta_001', destinationPath: 'C:/SENA/Docs/Series1' }]

    try {
        const existingPdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const results = [];

        for (const split of splits) {
            const newPdf = await PDFDocument.create();
            // Pages are 0-indexed in pdf-lib, but user input is likely 1-indexed
            const start = split.startPage - 1;
            const end = split.endPage - 1;

            const pageIndices = [];
            for (let i = start; i <= end; i++) {
                pageIndices.push(i);
            }

            const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach((page) => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();

            // Ensure directory exists
            if (!fs.existsSync(split.destinationPath)) {
                fs.mkdirSync(split.destinationPath, { recursive: true });
            }

            const finalPath = path.join(split.destinationPath, `${split.name}.pdf`);
            fs.writeFileSync(finalPath, pdfBytes);
            results.push({ name: split.name, status: 'Saved', path: finalPath });
        }

        // Cleanup temp file
        // fs.unlinkSync(filePath); 

        res.json({ message: 'PDF split successfully', results });

    } catch (error) {
        console.error('Error splitting PDF:', error);
        res.status(500).json({ error: 'Failed to split PDF' });
    }
});

module.exports = router;
