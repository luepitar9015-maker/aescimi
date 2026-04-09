const axios = require('axios');

async function run() {
    const API_URL = 'http://localhost:3001/api';
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        document_no: '1098680638',
        password: 'Santander2026**'
    });
    const adminToken = loginRes.data.token;
    console.log("Token:", adminToken);

    try {
        const susRes = await axios.put(`${API_URL}/users/12/toggle-status`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("Success:", susRes.data);
    } catch(e) {
        console.error("Fail:", e.response?.data || e.message);
    }
}
run();
