const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const adminDoc = '123456789';
const adminPass = 'admin123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(adminPass, salt);

db.serialize(() => {
    // 1. List current users
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) {
            console.error("Error reading users:", err);
            return;
        }
        console.log("Current Users found:", rows.length);
        rows.forEach(row => {
            console.log(`ID: ${row.id}, Doc: ${row.document_no}, Name: ${row.full_name}`);
        });

        // 2. Check Admin User
        db.get("SELECT * FROM users WHERE document_no = ?", [adminDoc], (err, row) => {
            if (row) {
                console.log("\nAdmin user exists. Updating password...");
                db.run("UPDATE users SET password_hash = ? WHERE document_no = ?", [hash, adminDoc], (err) => {
                    if (err) console.error("Error updating password:", err);
                    else console.log("Admin password updated successfully to 'admin123'.");
                });
            } else {
                console.log("\nAdmin user does not exist. Creating...");
                const stmt = db.prepare("INSERT INTO users (full_name, area, position, document_no, password_hash, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)");
                stmt.run("Administrador", "Sistemas", "Admin", adminDoc, hash, "admin@sena.edu.co", "admin", (err) => {
                    if (err) console.error("Error creating admin:", err);
                    else console.log("Admin user created successfully.");
                });
                stmt.finalize();
            }
        });
    });
});
