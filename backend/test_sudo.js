const { exec } = require('child_process');

function tryPassword(pwd) {
    return new Promise((resolve) => {
        exec(`echo '${pwd}' | sudo -S whoami`, (err, stdout, stderr) => {
            resolve({
                pwd,
                success: !err && stdout.trim() === 'root',
                stdout: stdout.trim(),
                stderr: stderr.trim()
            });
        });
    });
}

async function main() {
    const pwds = [
        'Aut0m4t1z4d0r2026%*',
        'Santander2026**',
        'admin2026',
        'Sena2025**',
    ];
    const results = [];
    for (const p of pwds) {
        const r = await tryPassword(p);
        results.push(r);
    }
    console.log(JSON.stringify(results, null, 2));
}

main();
