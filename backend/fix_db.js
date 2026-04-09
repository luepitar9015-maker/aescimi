const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Dropping TRD tables...");
    db.run("DROP TABLE IF EXISTS trd_series");
    db.run("DROP TABLE IF EXISTS trd_subseries");
    db.run("DROP TABLE IF EXISTS trd_typologies");
    console.log("Tables dropped. Restart server to recreate them.");
});

db.close();
