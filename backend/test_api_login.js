async function testLogin() {
    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_no: '1098680638',
                password: 'Santander2026**'
            })
        });

        const status = response.status;
        let data;
        try {
            data = await response.json();
        } catch(e) {
            data = await response.text();
        }

        console.log("Status:", status);
        console.log("Response:", data);
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

testLogin();
