const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Adding storage_path to organization_structure...");
    db.run("ALTER TABLE organization_structure ADD COLUMN storage_path TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log("Column storage_path already exists.");
            } else {
                console.error("Error adding column:", err);
            }
        } else {
            console.log("Column storage_path added successfully.");
        }
    });
});

db.close();
