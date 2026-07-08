const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DOWNLOADS_DIR = "C:\\Users\\Usuario\\Downloads";

function checkResponsiblesInTRD() {
    console.log("=== INSPECCIONANDO EXCEL DE RESPONSABLES EN DOWNLOADS ===");
    
    if (!fs.existsSync(DOWNLOADS_DIR)) {
        console.error("El directorio de descargas no existe.");
        return;
    }

    const files = fs.readdirSync(DOWNLOADS_DIR)
        .filter(f => f.toLowerCase().includes("responsable") && f.endsWith(".xlsx"));

    if (files.length === 0) {
        console.log("No se encontraron archivos con la palabra 'responsable' en Downloads.");
        return;
    }

    files.forEach(file => {
        const fullPath = path.join(DOWNLOADS_DIR, file);
        console.log(`\nArchivo encontrado: ${file}`);
        try {
            const workbook = XLSX.readFile(fullPath);
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length === 0) return;
                
                console.log(`  Hoja: ${sheetName} (Filas: ${jsonData.length})`);
                
                // Imprimir las primeras 5 filas para ver la estructura
                console.log("  Muestra de columnas:", Object.keys(jsonData[0]));
                console.log("  Primeras 3 filas:");
                console.table(jsonData.slice(0, 3));

                // Buscar filas que mencionen a Jesús o Luis Miguel
                const matches = [];
                jsonData.forEach((row, rIdx) => {
                    const rowStr = JSON.stringify(row).toLowerCase();
                    if (rowStr.includes("jesus") || rowStr.includes("luis miguel")) {
                        matches.push({ fila: rIdx + 2, data: row });
                    }
                });

                if (matches.length > 0) {
                    console.log(`  -> ¡Encontradas ${matches.length} coincidencias con Jesús o Luis Miguel en esta hoja!`);
                    matches.slice(0, 10).forEach(m => {
                        console.log(`    Fila ${m.fila}:`, m.data);
                    });
                }
            });
        } catch (e) {
            console.error("  Error al leer:", e.message);
        }
    });
}

checkResponsiblesInTRD();
