async function testLogin() {
    try {
        console.log("Testing Superuser Login...");
        const loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_no: '1098680638',
                password: 'Santander2026**'
            })
        });
        const loginData = await loginRes.json();
        
        if (!loginRes.ok) {
            console.error("Login failed:", loginData);
            return;
        }

        console.log("Login Successful!");
        console.log("User:", loginData.user);
        const token = loginData.token;

        console.log("\nTesting Superuser Module (Tables list)...");
        const tablesRes = await fetch('http://localhost:3001/api/superuser/tables', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const tablesData = await tablesRes.json();
        console.log("Tables found:", tablesData);

        console.log("\nTesting Expiration Check (Regular Admin)...");
        const adminLoginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_no: '123456789',
                password: 'admin123'
            })
        });
        const adminData = await adminLoginRes.json();
        
        if (adminLoginRes.ok) {
            console.log("Admin Login Successful (as expected if not expired).");
        } else if (adminData.expired) {
            console.log("System Expired! (This is what we want if we set a past date)");
        } else {
            console.error("Admin Login failed unexpectedly:", adminData);
        }

    } catch (err) {
        console.error("Test error:", err.message);
    }
}

testLogin();
