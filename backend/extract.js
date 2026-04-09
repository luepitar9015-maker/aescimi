const fs = require('fs');
let txt = fs.readFileSync('test_output.txt', 'utf8');
if (txt.includes('\u0000')) {
    txt = fs.readFileSync('test_output.txt', 'utf16le');
}
const parts = txt.split('=== AUTOMATION RESULTS ===');
if (parts.length > 1) {
    try {
        const json = JSON.parse(parts[1].trim());
        console.log("LOGS:");
        console.log(json.logs.join('\n'));
        console.log("TEST MODE:", json.test_mode);
        console.log("SUCCESS:", !json.logs.some(l => l.includes('[ERROR]')));
    } catch(e) { console.log("PARSE ERROR", e.message); }
} else {
    console.log("NOT FOUND RESULTS");
}
