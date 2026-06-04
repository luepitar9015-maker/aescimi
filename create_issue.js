const fs = require('fs');
const https = require('https');

try {
    const diagnostics = fs.readFileSync('setup_log.txt', 'utf8');

    const postData = JSON.stringify({
        title: `Diagnostics ${new Date().toISOString()}`,
        body: diagnostics
    });

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.error("GITHUB_TOKEN env variable not set.");
        process.exit(1);
    }

    const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/repos/luepitar9015-maker/aescimi/issues',
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'NodeJS-Diagnostics-Script',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            body += chunk;
        });
        res.on('end', () => {
            console.log(`Response finished. Status: ${res.statusCode}`);
            if (res.statusCode !== 201) {
                console.error(`Failed to create issue: ${body}`);
            } else {
                console.log("Successfully created issue!");
            }
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
} catch (err) {
    console.error("Error in create_issue.js:", err.message);
}
