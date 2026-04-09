async function runTest() {
    try {
        console.log("1. Logging in...");
        const loginRes = await fetch('http://localhost:3001/api/auth/login', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_no: '1098680638', password: 'Santander2026**' })
        });
        
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        const loginData = await loginRes.json();
        const token = loginData.token;
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        console.log("Login successful.");

        console.log("2. Fetching settings...");
        const settingsRes = await fetch('http://localhost:3001/api/settings/all', { headers });
        const settings = await settingsRes.json();
        if (!settings.ades_url) {
            console.error("AES settings not configured properly. URL is missing.");
            return;
        }

        console.log("3. Fetching pending documents...");
        let docsRes = await fetch('http://localhost:3001/api/ades/pending', { headers });
        let pendingDocs = await docsRes.json() || [];
        
        if (!Array.isArray(pendingDocs) || pendingDocs.length === 0) {
            console.log("No pending documents. Checking all documents...");
            const allDocsRes = await fetch('http://localhost:3001/api/documents', { headers });
            let allDocsData = await allDocsRes.json();
            const allDocs = allDocsData.data || allDocsData;
            
            if (allDocs && allDocs.length > 0) {
                const docToUpdate = allDocs[0];
                console.log(`Setting document ${docToUpdate.id} to 'Pendiente'.`);
                await fetch('http://localhost:3001/api/ades/update-status', { 
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id: docToUpdate.id, status: 'Pendiente', ades_id: null })
                });
                
                const finalDocsRes = await fetch('http://localhost:3001/api/ades/pending', { headers });
                pendingDocs = await finalDocsRes.json() || [];
            } else {
                console.log("No documents exist in the system at all. Please create one first.");
                return;
            }
        }

        if (!Array.isArray(pendingDocs) || pendingDocs.length === 0) return;

        const testDoc = pendingDocs[0];
        console.log(`Testing with document ID: ${testDoc.id}, Name: ${testDoc.filename}`);

        console.log("4. Running automation...");
        const execRes = await fetch('http://localhost:3001/api/automation/execute', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                url: settings.ades_url,
                username: settings.ades_username,
                password: settings.ades_password,
                documentId: testDoc.id,
                docInfo: testDoc
            })
        });
        
        const execData = await execRes.json();
        
        console.log("=== AUTOMATION RESULTS ===");
        console.log(JSON.stringify(execData, null, 2));

    } catch (err) {
        console.error("Test failed:");
        console.error(err.message);
    }
}

runTest();
