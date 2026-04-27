require('dotenv').config();

const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const puppeteer = require('puppeteer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database');
const pool = db.pool; // pool de Postgres directo
const { requireAuth } = require('./middleware/authMiddleware');

// Validate JWT_SECRET at startup to prevent insecure fallback
if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not set in environment variables.');
    process.exit(1);
}
const SECRET_KEY = process.env.JWT_SECRET;

// New Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users'); // Restored
const documentRoutes = require('./routes/documents');
const adesRoutes = require('./routes/ades');
const automationRoutes = require('./routes/automation');
const permissionsRoutes = require('./routes/permissions');

const app = express();
// Puerto: 3000 internamente (Nginx maneja el 443 con SSL)
const port = process.env.PORT || 3000;

// CORS: restrict to known trusted origins only
const allowedOrigins = [
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/,
    process.env.FRONTEND_URL ? new RegExp(`^${process.env.FRONTEND_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : null,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl, same-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(pattern => pattern.test(origin))) {
            return callback(null, true);
        }
        callback(new Error(`CORS: Origin '${origin}' is not allowed.`));
    },
    credentials: true
}));

// Rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,             // Max 15 login attempts per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión. Por favor, espere un momento.' }
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Auth Middleware to extract user from token
app.use((req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            // Token invalid - ignore but continue
        }
    }
    next();
});

// Crear tabla system_settings al inicio (asegura que siempre exista)
pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.warn('[Server] system_settings:', e.message));

// System Expiration Middleware
app.use((req, res, next) => {
    // Skip expiration check for auth and superuser login
    if (req.path.startsWith('/api/auth')) return next();
    
    pool.query("SELECT value FROM system_settings WHERE key = 'system_expiration_date'", [])
        .then(result => {
            const setting = result.rows[0];
            if (setting && setting.value) {
                const expDate = new Date(setting.value);
                const now = new Date();
                if (now > expDate && (!req.user || req.user.role !== 'superadmin')) {
                    return res.status(403).json({ 
                        error: 'El sistema ha caducado. Contacte al administrador.',
                        expired: true 
                    });
                }
            }
            next();
        })
        .catch(() => next()); // Si la tabla no existe aún, continuar sin bloquear
});

// Setup multer for file upload
const upload = multer({ dest: 'uploads/' });

// Register API Routes
app.use('/api/auth/login', authLimiter); // Apply rate limiter to login
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes); // Restored
app.use('/api/expedientes', require('./routes/expedientes'));
app.use('/api/documents', documentRoutes);
app.use('/api/ades', adesRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/trd-permissions', require('./routes/trd_permissions'));
app.use('/api/organization', require('./routes/organization')); // Restored
app.use('/api/trd', require('./routes/trd_new.js')); // New TRD routes
app.use('/api/settings', require('./routes/settings')); // Global Settings
app.use('/api/permissions', permissionsRoutes);
app.use('/api/superuser', require('./routes/superuser'));
app.use('/api/system', require('./routes/system')); // System Routes (Backup, etc)

// ── RUTA TEMPORAL: Reproductor de video para análisis (SOLO USO LOCAL) ──
app.get('/video-player', (req, res) => {
    res.sendFile(path.join(__dirname, 'video_player.html'));
});
app.get('/api/video/fecha', (req, res) => {
    const videoPath = 'C:\\Users\\Usuario\\Downloads\\GRABACION DE FECHA CREACION DOCUMENTO.mp4';
    if (!require('fs').existsSync(videoPath)) {
        return res.status(404).send('Video no encontrado');
    }
    const stat = require('fs').statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = require('fs').createReadStream(videoPath, { start, end });
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        });
        file.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
        require('fs').createReadStream(videoPath).pipe(res);
    }
});


// Ensure templates directory exists
const templatesDir = path.join(__dirname, 'templates');
const templateInitial = path.join(templatesDir, 'letter-template-initial.html');
const templateFinal = path.join(templatesDir, 'letter-template-final.html');

app.post('/api/generate-letters', requireAuth, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'template', maxCount: 1 }]), async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No excel file uploaded.');
    }

    const excelFile = req.files.file[0];
    const templateFile = req.files.template ? req.files.template[0] : null;

    const letterType = req.body.letterType || 'initial';
    const filenameColumn = req.body.filenameColumn || '';
    
    // Default templates
    const templatePath = letterType === 'final' ? templateFinal : templateInitial;

    try {
        let localData = [];

        // Determine data source: Selected Rows (JSON) or Full File (Excel)
        if (req.body.selectedData) {
            try {
                localData = JSON.parse(req.body.selectedData);
                console.log(`Using ${localData.length} selected rows from frontend.`);
            } catch (err) {
                console.error('Error parsing selectedData:', err);
                return res.status(400).send('Invalid selected data format.');
            }
        } else if (excelFile) {
            // Read Excel file
            const workbook = xlsx.readFile(excelFile.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            localData = xlsx.utils.sheet_to_json(sheet);
        } else {
             return res.status(400).send('No Excel file or data provided.');
        }

        if (localData.length === 0) {
            return res.status(400).send('No data to process.');
        }

        // Read HTML template or Convert Word Template
        let templateHtml;
        try {
            if (templateFile) {
                const mammoth = require('mammoth');
                const result = await mammoth.convertToHtml({ path: templateFile.path });
                templateHtml = result.value;
                 // Add basic styling to converted HTML
                 templateHtml = `
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; padding: 20px; }
                            table { border-collapse: collapse; width: 100%; }
                            td, th { border: 1px solid #ddd; padding: 8px; }
                        </style>
                    </head>
                    <body>
                        ${templateHtml}
                    </body>
                    </html>
                `;
            } else {
                templateHtml = fs.readFileSync(templatePath, 'utf8');
            }
        } catch (err) {
            console.error('Error reading template:', err);
            return res.status(500).send('Error reading template file.');
        }

        // Initialize Puppeteer
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Array to store individual PDF buffers
        const pdfBuffers = [];

        for (const [index, row] of localData.entries()) {
            // Replace placeholders in template
            let content = templateHtml;

            // Map Excel columns to template placeholders
            const formatDate = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
            const formatTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

            // Common fields for both templates
            content = content.replace(/{{nombre}}/gi, row['NOMBRE'] || row['Nombre'] || 'N/A');
            content = content.replace(/{{apellidos}}/gi, row['APELLIDOS'] || row['Apellidos'] || '');
            content = content.replace(/{{tipo}}/gi, row['TIPO'] || row['Tipo'] || 'CC');
            content = content.replace(/{{documento}}/gi, row['DOCUMENTO'] || row['Documento'] || row['CC'] || row['Cc'] || 'N/A');
            content = content.replace(/{{correo}}/gi, row['CORREO ELECTRONICO'] || row['CORREO'] || row['Correo'] || 'N/A');
            content = content.replace(/{{direccion}}/gi, row['DIRECCION'] || row['Direccion'] || 'N/A');
            content = content.replace(/{{programa}}/gi, row['PROGRAMA'] || row['Programa'] || 'N/A');
            content = content.replace(/{{ficha}}/gi, row['FICHA'] || row['Ficha'] || 'N/A');
            content = content.replace(/{{fecha}}/gi, row['FECHA'] || formatDate);
            content = content.replace(/{{radicado}}/gi, row['RADICADO'] || row['Radicado'] || 'N/A');

            // Additional fields for initial notification
            content = content.replace(/{{nivel}}/gi, row['NIVEL'] || row['Nivel'] || 'N/A');
            content = content.replace(/{{tipo_formacion}}/gi, row['TIPO FORMACION'] || row['TIPO_FORMACION'] || row['Tipo Formacion'] || 'N/A');
            content = content.replace(/{{fecha_inicio}}/gi, row['FECHA DE INICIO'] || row['FECHA_INICIO'] || row['Fecha de Inicio'] || 'N/A');
            content = content.replace(/{{instructor}}/gi, row['INSTRUCTOR'] || row['Instructor'] || 'N/A');
            content = content.replace(/{{hora_notificacion}}/gi, row['HORA DE NOTIFICACION'] || row['HORA_NOTIFICACION'] || formatTime);

            // Legacy fields for backward compatibility (final notification)
            content = content.replace(/{{name}}/gi, row['NOMBRE'] || row['Nombre'] || 'N/A');
            // Parse column mapping if provided
            let mapping = {};
            if (req.body.columnMapping) {
                try {
                    mapping = JSON.parse(req.body.columnMapping);
                } catch (e) {
                    console.error('Error parsing column mapping:', e);
                }
            }

            // First, create a normalized row object based on mapping
            // This ensures that if a template placeholder {{KEY}} is mapped to an Excel column,
            // the value from that Excel column is used.
            const normalizedRow = { ...row };
            Object.keys(mapping).forEach(templatePlaceholder => {
                const excelCol = mapping[templatePlaceholder];
                if (row[excelCol] !== undefined) {
                    normalizedRow[templatePlaceholder] = row[excelCol];
                }
            });

            // Helper to escape regex special characters
            const escapeRegExp = (string) => {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };

            // Standard replacement using normalized row (includes mapped values and original row values)
            Object.keys(normalizedRow).forEach(key => {
                const value = normalizedRow[key] !== undefined ? normalizedRow[key] : '';
                const escapedKey = escapeRegExp(key);
                const regex = new RegExp(`{{${escapedKey}}}`, 'gi');
                content = content.replace(regex, value);
            });
            // Replace extra fields from Excel (direct columns)
            Object.keys(row).forEach(key => {
                const value = row[key] !== undefined ? row[key] : '';
                const escapedKey = escapeRegExp(key);
                const regex = new RegExp(`{{${escapedKey}}}`, 'gi');
                content = content.replace(regex, value);
            });

            // Set content and generate PDF
            await page.setContent(content, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px'
                }
            });

            pdfBuffers.push(pdfBuffer);
        }

        await browser.close();

        // Merge all PDFs using pdf-lib
        const { PDFDocument } = require('pdf-lib');
        const mergedPdf = await PDFDocument.create();

        for (const pdfBuffer of pdfBuffers) {
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();

        // Determine filename logic
        let filename = 'Cartas_SENA.pdf';
        
        // Priority 1: User selected filename column
        if (filenameColumn && localData[0] && localData[0][filenameColumn]) {
             filename = `${localData[0][filenameColumn]}_Cartas.pdf`;
        } 
        // Priority 2: Legacy logic
        else if (letterType === 'final' && localData[0]?.['RADICADO FINAL']) {
            filename = `Cartas_${localData[0]['RADICADO FINAL']}.pdf`;
        } else if (localData[0]?.['RADICADO']) {
            filename = `Cartas_${localData[0]['RADICADO']}.pdf`;
        }

        // Clean up uploaded files
        try { fs.unlinkSync(excelFile.path); } catch (e) {}
        if (templateFile) { try { fs.unlinkSync(templateFile.path); } catch (e) {} }

        // Send unified PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(mergedPdfBytes));

    } catch (error) {
        console.error('Error generating letters:', error);
        res.status(500).send('Error generating letters.');
        // Cleanup on error
        try { if (excelFile) fs.unlinkSync(excelFile.path); } catch (e) {}
        try { if (templateFile) fs.unlinkSync(templateFile.path); } catch (e) {}
    }
});

// Configurar servidor para servir el Frontend compilado en Producción
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Redirigir cualquier otra petición (que no sea API) al index.html de React
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// ══════════════════════════════════════════════════════════════
// HTTP únicamente — SSL/TLS es responsabilidad del proxy Nginx.
// NO se usan certificados autofirmados ni Let's Encrypt aquí.
// Nginx recibe en 80/443 y reenvía a este proceso por HTTP.
// ══════════════════════════════════════════════════════════════
const http = require('http');
http.createServer(app).listen(port, '0.0.0.0', () => {
    console.log(`[SERVER] ✅ HTTP escuchando en http://0.0.0.0:${port}`);
    console.log(`[SERVER] 🔀 Proxy inverso Nginx maneja HTTPS externamente.`);
});

