require('dotenv').config();
const { pool } = require('./database_pg');

pool.query("SELECT id, title, metadata_values FROM expedientes WHERE metadata_values LIKE '%7%' ORDER BY id DESC LIMIT 5")
    .then(r => console.log(r.rows))
    .finally(() => pool.end());
