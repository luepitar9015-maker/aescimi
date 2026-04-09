const axios = require('axios');

async function runTests() {
    const API_URL = 'http://localhost:3001/api';
    let adminToken = '';
    let testUserId = null;
    let tempToken = '';

    console.log("=== Test 1: Admin Login ===");
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            document_no: '1098680638',
            password: 'Santander2026**'
        });
        adminToken = loginRes.data.token;
        console.log("Admin logged in.");
    } catch(e) {
        console.error("Admin login failed", e.message); return;
    }

    console.log("\n=== Test 2: Create New User ===");
    try {
        const createRes = await axios.post(`${API_URL}/users`, {
            full_name: 'Suspend Test',
            document_no: 'SUSPEND123',
            password: 'SUSPEND123',
            email: 'suspend@test.com',
            role: 'user',
            organization_id: 1,
            position: 'Test',
            area: 'Test'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        testUserId = createRes.data.id;
        console.log("Test user created ID:", testUserId);
    } catch(e) {
        console.error("User creation failed", e.response?.data || e.message); return;
    }

    console.log("\n=== Test 3: Login NEW User (Check must_change_password) ===");
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            document_no: 'SUSPEND123',
            password: 'SUSPEND123'
        });
        tempToken = loginRes.data.token;
        console.log("Must change password?", loginRes.data.user.mustChangePassword); // Should be true
        if (loginRes.data.user.mustChangePassword !== true) throw new Error("Flag not working");
    } catch(e) {
        console.error("New user login failed", e.response?.data || e.message); return;
    }

    console.log("\n=== Test 4: Suspend User ===");
    try {
        const susRes = await axios.put(`${API_URL}/users/${testUserId}/toggle-status`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("User suspended:", susRes.data);
    } catch(e) {
         console.error("Suspend failed", e.response?.data || e.message); return;
    }

    console.log("\n=== Test 5: Login Suspended User ===");
    try {
        await axios.post(`${API_URL}/auth/login`, {
            document_no: 'SUSPEND123',
            password: 'SUSPEND123'
        });
        console.error("Should have failed!");
    } catch(e) {
        console.log("Correctly prevented login:", e.response?.data?.error); // Should be "Su cuenta ha sido suspendida..."
    }

    console.log("\n=== Test 6: Reactivate User ===");
    try {
        const susRes = await axios.put(`${API_URL}/users/${testUserId}/toggle-status`, {}, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("User reactivated:", susRes.data);
    } catch(e) {
         console.error("Reactivate failed", e.response?.data || e.message); return;
    }

    console.log("\n=== Test 7: Change Password as User ===");
    try {
        const pwdRes = await axios.post(`${API_URL}/users/change-password`, {
            password: 'NEWPASSWORD123'
        }, { headers: { Authorization: `Bearer ${tempToken}` } });
        console.log("Password changed:", pwdRes.data);
    } catch(e) {
        console.error("Password change failed", e.response?.data || e.message); return;
    }

    console.log("\n=== Test 8: Login With New Password ===");
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            document_no: 'SUSPEND123',
            password: 'NEWPASSWORD123'
        });
        console.log("Must change password?", loginRes.data.user.mustChangePassword); // Should be false
    } catch(e) {
        console.error("New password login failed", e.response?.data || e.message);
    }

    console.log("\n=== Cleanup: Delete Test User ===");
    try {
         await axios.delete(`${API_URL}/users/${testUserId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("Done.");
    } catch(e) { console.error("Cleanup failed", e.message); }
}

runTests();
