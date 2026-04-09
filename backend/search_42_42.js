require('dotenv').config();
const db = require('./database.js');

db.all("SELECT id, subseries_code, subseries_name FROM trd_subseries WHERE subseries_code LIKE '%42.42%'", [], (err, rows) => {
    if (err) throw err;
    console.log("trd_subseries containing 42.42: ", rows);
});
