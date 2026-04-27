const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/backup', requireAuth, async (req, res) => {
    // Solo permitir a admin o superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador para realizar copias de seguridad.' });
    }

    try {
        console.log("=== INICIANDO COPIA DE SEGURIDAD (API) ===");

        // 1. Encontrar pg_dump
        let pgDumpPath = '';
        const possiblePaths = [
            "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe",
            "C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe"
        ];
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                pgDumpPath = p;
                break;
            }
        }

        if (!pgDumpPath) {
            pgDumpPath = "pg_dump";
        }

        const dbUser = process.env.DB_USER || 'postgres';
        const dbPass = process.env.DB_PASSWORD || 'root';
        const dbName = process.env.DB_NAME || 'sena_db';
        
        const tempSqlPath = path.join(__dirname, '..', 'temp_backup.sql');
        
        // 2. Exportar la Base de Datos
        console.log(`Usando pg_dump: ${pgDumpPath}`);
        try {
            process.env.PGPASSWORD = dbPass;
            execSync(`"${pgDumpPath}" -U ${dbUser} -h localhost -d ${dbName} -f "${tempSqlPath}"`);
            console.log("✅ Base de datos exportada temporalmente.");
        } catch (e) {
            console.error("❌ Error exportando base de datos.");
            console.error(e.message);
            return res.status(500).json({ error: 'Error exportando la base de datos de PostgreSQL.' });
        }

        // 3. Preparar el streaming del ZIP al cliente
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=backup_sena_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.zip`
        });

        const archive = archiver('zip', {
            zlib: { level: 5 } // Nivel de compresión balanceado
        });

        archive.on('error', (err) => {
            console.error("Error al crear el archivo ZIP", err);
            res.end();
        });

        // Cuando finalice el archivo zip, eliminar el archivo SQL temporal
        res.on('finish', () => {
            try {
                if (fs.existsSync(tempSqlPath)) {
                    fs.unlinkSync(tempSqlPath);
                }
                console.log("✅ Copia de seguridad completada y enviada.");
            } catch (err) {
                console.error("No se pudo eliminar el backup SQL temporal", err);
            }
        });

        archive.pipe(res);

        // Añadir el archivo SQL de la base de datos
        archive.file(tempSqlPath, { name: 'base_de_datos.sql' });

        // Añadir el directorio de uploads si existe
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (fs.existsSync(uploadsDir)) {
            archive.directory(uploadsDir, 'uploads');
        }

        await archive.finalize();

    } catch (error) {
        console.error("Error en la ruta de backup:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor al generar la copia de seguridad.' });
        } else {
            res.end();
        }
    }
});

module.exports = router;
