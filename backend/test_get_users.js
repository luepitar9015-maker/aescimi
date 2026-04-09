const axios = require('axios');
async function test() {
    try {
        const loginRes = await axios.post('http://localhost:3001/api/auth/login', { 
            document_no: '1098680638', 
            password: 'Santander2026**' 
        });
        const token = loginRes.data.token;
        const usersRes = await axios.get('http://localhost:3001/api/users', { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        console.log('Users:', usersRes.data);
    } catch(e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();
