const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const xlsx = require('xlsx');

async function test() {
    try {
        const loginRes = await axios.post('http://localhost:3001/api/auth/login', { 
            document_no: '1098680638', 
            password: 'Santander2026**' 
        });
        const token = loginRes.data.token;
        
        const tmplRes = await axios.get('http://localhost:3001/api/users/template', { 
            headers: { Authorization: `Bearer ${token}` }, 
            responseType: 'arraybuffer' 
        });
        
        fs.writeFileSync('test_template.xlsx', tmplRes.data);
        const wb = xlsx.readFile('test_template.xlsx');
        const ws = wb.Sheets[wb.SheetNames[0]];
        let data = xlsx.utils.sheet_to_json(ws);
        
        data[0]['Documento'] = 'BULKTEST' + Date.now();
        data.push({
            'Nombre Completo': 'Test User 2', 
            'Documento': 'BULKTEST' + (Date.now()+1), 
            'Email': 'test2@sena.edu.co', 
            'Cargo': 'Admin', 
            'Dependencia_ID': '1', 
            'Rol': 'admin'
        });
        
        const newWs = xlsx.utils.json_to_sheet(data);
        wb.Sheets[wb.SheetNames[0]] = newWs;
        xlsx.writeFile(wb, 'test_template2.xlsx');
        
        const form = new FormData();
        form.append('file', fs.createReadStream('test_template2.xlsx'));
        
        const uploadRes = await axios.post('http://localhost:3001/api/users/bulk', form, { 
            headers: { 
                ...form.getHeaders(), 
                Authorization: `Bearer ${token}` 
            } 
        });
        
        console.log('Upload result:', uploadRes.data);
    } catch(e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();
