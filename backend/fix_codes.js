require('dotenv').config();
const db = require('./database.js');

const fixDuplicatedCodes = () => {
    // Fix trd_subseries
    db.all("SELECT id, subseries_code, series_id FROM trd_subseries", [], (err, rows) => {
        if (err) throw err;
        let count = 0;
        let processed = 0;
        
        if (rows.length === 0) {
            console.log("No subseries found.");
            return;
        }

        rows.forEach(row => {
            if (!row.subseries_code) {
                processed++;
                return;
            }
            const parts = row.subseries_code.split('-');
            if (parts.length >= 2) {
                const dep = parts[0];
                const trdPart = parts[1];
                const trdSegments = trdPart.split('.');
                // If it looks like 02.02.45
                if (trdSegments.length >= 2 && trdSegments[0] === trdSegments[1]) {
                    trdSegments.shift();
                    const newCode = `${dep}-${trdSegments.join('.')}`;
                    db.run("UPDATE trd_subseries SET subseries_code = ? WHERE id = ?", [newCode, row.id], (err) => {
                        if (err) console.error(err);
                    });
                    count++;
                }
            }
            processed++;
            if (processed === rows.length) {
                console.log(`Fixed ${count} duplicated trd_subseries codes.`);
            }
        });
    });

    // Fix expedientes
    db.all("SELECT id, subserie FROM expedientes", [], (err, rows) => {
        if (err) throw err;
        let count = 0;
        let processed = 0;

        if (rows.length === 0) {
            console.log("No expedientes found.");
            return;
        }
        
        rows.forEach(row => {
            if (!row.subserie) {
                processed++;
                return;
            }
            const parts = row.subserie.split('-');
            if (parts.length >= 2) {
                const dep = parts[0];
                const trdPart = parts[1];
                const trdSegments = trdPart.split('.');
                if (trdSegments.length >= 2 && trdSegments[0] === trdSegments[1]) {
                    trdSegments.shift();
                    const newCode = `${dep}-${trdSegments.join('.')}`;
                    db.run("UPDATE expedientes SET subserie = ? WHERE id = ?", [newCode, row.id], (err) => {
                        if (err) console.error(err);
                    });
                    count++;
                }
            }
            processed++;
            if (processed === rows.length) {
                console.log(`Fixed ${count} duplicated expedientes subserie codes.`);
            }
        });
    });
};

fixDuplicatedCodes();
