const fs = require('fs');
const path = require('path');

function searchAlert(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchAlert(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('alert(')) {
                    console.log(`[${fullPath}:${i+1}] ${lines[i].trim()}`);
                }
            }
        }
    }
}

searchAlert('d:\\copia del sistema sena\\frontend\\src');
