require('dotenv').config();
const { pool } = require('./database_pg');

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'trd_typologies'")
    .then(r => console.log(r.rows.map(x => x.column_name)))
    .finally(() => pool.end());
