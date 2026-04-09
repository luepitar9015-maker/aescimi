require('dotenv').config();
const db = require('./database.js');

db.all("SELECT id, subseries_code, subseries_name FROM trd_subseries WHERE subseries_name LIKE '%INFORMES%'", [], (err, rows) => {
    if (err) throw err;
    console.log("trd_subseries: ", rows);
});
