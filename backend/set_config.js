require('dotenv').config();
const { pool } = require('./database_pg');

async function updateConfig() {
    try {
        const newHierarchy = JSON.stringify([
            { type: 'dep', label: 'Dependencia' },
            { type: 'ser', label: 'Serie' },
            { type: 'meta_4', label: 'Radicado (Valor 4)' },
            { type: 'typology', label: 'Tipología Documental' }
        ]);

        await pool.query(
            "UPDATE system_settings SET value = $1 WHERE key = 'folder_hierarchy'",
            [newHierarchy]
        );
        console.log("Configuración actualizada usando Metadato 4 para el Expediente y Tipologías.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

updateConfig();
