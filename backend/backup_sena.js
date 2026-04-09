require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const destDir = "D:\\SENA V2\\INSTALADOR_SENA";
const dbDumpFile = path.join(sourceDir, "base_de_datos_sena_db.sql");

async function doBackup() {
    console.log("=== INICIANDO COPIA DE SEGURIDAD ===");

    // 1. Export PostgreSQL Database
    console.log("1. Buscando pg_dump.exe...");
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
        // intentemos que este en el path directo
        pgDumpPath = "pg_dump";
    }

    console.log(`Usando pg_dump: ${pgDumpPath}`);
    try {
        console.log("Exportando sena_db...");
        const dbUser = process.env.DB_USER || 'postgres';
        const dbPass = process.env.DB_PASSWORD || 'root';
        const dbName = process.env.DB_NAME || 'sena_db';
        
        process.env.PGPASSWORD = dbPass;
        execSync(`"${pgDumpPath}" -U ${dbUser} -h localhost -d ${dbName} -f "${dbDumpFile}"`);
        console.log(`✅ Base de datos exportada a: ${dbDumpFile}`);
    } catch (e) {
        console.error("❌ Error exportando base de datos. Asegúrate de tener PostgreSQL corriendo.");
        console.error(e.message);
        // Continuamos de todos modos con la copia de la carpeta
    }

    // 2. Copiar todo el directorio a D:\SENA V2 utilizando Robocopy
    console.log(`2. Copiando carpeta de sistema a ${destDir} ...`);
    
    // Create destination drive directory if it doesn't exist
    if (!fs.existsSync("D:\\SENA V2")) {
        try {
            fs.mkdirSync("D:\\SENA V2", { recursive: true });
        } catch (e) {
            console.error("❌ No se pudo crear D:\\SENA V2. ¿Asegúrate de que la unidad D: existe?");
            process.exit(1);
        }
    }

    try {
        const roboCmd = `robocopy "${sourceDir}" "${destDir}" /MIR /XD ".git" "node_modules_old" /NFL /NDL /NJH /NJS /nc /ns /np`;
        execSync(roboCmd, { stdio: 'ignore' });
    } catch (e) {
        // Robocopy returns codes < 8 for success, so execSync will throw if it returns 1, 2, 3..
        // but 1-7 are actually success modes in robocopy.
        if (e.status < 8) {
            console.log(`✅ Copia terminada (Estado Robocopy: ${e.status})`);
        } else {
            console.error("❌ Error en Robocopy:", e.message);
        }
    }

    console.log("=== COPIA DE SEGURIDAD COMPLETADA ===");
}

doBackup();
