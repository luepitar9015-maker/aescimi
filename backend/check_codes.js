require('dotenv').config();
const db = require('./database.js');

db.all("SELECT id, subseries_code FROM trd_subseries WHERE subseries_code LIKE '%42%'", [], (err, rows) => {
    if (err) throw err;
    console.log("trd_subseries: ", rows);
});
