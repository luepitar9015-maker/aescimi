// Native fetch is available in Node 18+

// Helper to make requests
async function post(url, body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        console.log(`POST ${url}:`, response.status, data);
        return data;
    } catch (err) {
        console.error(`Error POST ${url}:`, err.message);
    }
}

async function runTest() {
    const baseUrl = 'http://127.0.0.1:3001/api/trd';
    
    // 1. Create Series (Simple)
    console.log("--- TEST 1: Simple Series ---");
    const series1 = await post(`${baseUrl}/series`, {
        dependency_id: 1, // Assumptions: Dependency ID 1 exists
        code: '100',
        name: 'SERIE SIMPLE TEST'
    });

    if (series1 && series1.id) {
        // Add Typology to Simple Series
        await post(`${baseUrl}/typology`, {
            series_id: series1.id,
            name: 'Tipología Simple Test'
        });
    }

    // 2. Create Series (Complex)
    console.log("\n--- TEST 2: Complex Series ---");
    const series2 = await post(`${baseUrl}/series`, {
        dependency_id: 1,
        code: '200',
        name: 'SERIE COMPLEJA TEST'
    });

    if (series2 && series2.id) {
        // Add Subseries
        const sub = await post(`${baseUrl}/subseries`, {
            series_id: series2.id,
            code: '200.1',
            name: 'SUBSERIE TEST'
        });

        if (sub && sub.id) {
            // Add Typology to Subseries
            await post(`${baseUrl}/typology`, {
                series_id: series2.id, // Optional linkage to series
                subseries_id: sub.id,
                name: 'Tipología Compleja Test'
            });
        }
    }
}

// Check if node-fetch is available, otherwise mock or use native
if (typeof fetch === 'undefined') {
    console.log("Native fetch not found, checking node version...");
    // Just run it, Node 18+ has fetch. If not, this script might fail if node-fetch isn't installed.
    // We'll use a simple http request fallback if needed, but let's try native first.
}

runTest();
