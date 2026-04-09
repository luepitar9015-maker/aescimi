require('dotenv').config();
const db = require('./database_pg');
const bcrypt = require('bcryptjs');

const document_no = '1098680638';
const password = 'Santander2026**';

db.get("SELECT * FROM users WHERE document_no = ?", [document_no], (err, user) => {
    if (err) {
        console.error('DB Error:', err);
        process.exit(1);
    }
    if (!user) {
        console.log('User not found');
        process.exit();
    }
    console.log('User found:', user);
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    console.log('Password valid:', validPassword);
    
    // Check if there are multiple users with this document_no
    db.all("SELECT id, document_no, role FROM users WHERE document_no = ?", [document_no], (err, users) => {
        console.log("All matching users:", users);
        process.exit();
    });
});
