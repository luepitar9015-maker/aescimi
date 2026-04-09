const testConnection = async () => {
    try {
        console.log("Testing GET http://127.0.0.1:3001/api/users ...");
        const res = await fetch('http://127.0.0.1:3001/api/users');
        console.log("Users Status:", res.status);
        console.log("Users Content-Type:", res.headers.get('content-type'));
        if (res.ok) {
            const data = await res.json();
            console.log("Users Data Sample:", data.length > 0 ? data[0] : 'Empty array');
        } else {
            console.log("Users Text:", await res.text());
        }
    } catch (err) {
        console.error("Users GET Failed:", err.message);
    }
};

const testOrganization = async () => {
    try {
        console.log("\nTesting POST http://127.0.0.1:3001/api/organization ...");
        const res = await fetch('http://127.0.0.1:3001/api/organization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entity_name: 'SENA',
                regional_code: 'TEST_REG_1',
                regional_name: 'Test Regional',
                center_code: 'TEST_CEN_1',
                center_name: 'Test Center',
                section_code: 'TEST_SEC_1',
                section_name: 'Test Section',
                subsection_code: '',
                subsection_name: '',
                isComplex: false
            })
        });
        console.log("Org Status:", res.status);
        console.log("Org Content-Type:", res.headers.get('content-type'));
        
        const text = await res.text();
        console.log("Org Response Body:", text.substring(0, 200)); // First 200 chars
    } catch (err) {
        console.error("Org POST Failed:", err.message);
    }
};

(async () => {
    await testConnection();
    await testOrganization();
})();
