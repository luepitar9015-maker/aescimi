require('dotenv').config();

async function testApi() {
    try {
        const db = require('./database.js');
        db.get("SELECT dependency_id FROM trd_series WHERE id = (SELECT series_id FROM trd_subseries WHERE id=158)", [], async (err, row) => {
            if (row) {
                console.log("Dependency ID:", row.dependency_id);
                // Call the endpoint manually
                const res = await fetch(`http://localhost:3001/api/trd/${row.dependency_id}`);
                const data = await res.json();
                console.log("Response:", JSON.stringify(data, null, 2));
            }
        });
    } catch(e) {
        console.error(e);
    }
}
testApi();
