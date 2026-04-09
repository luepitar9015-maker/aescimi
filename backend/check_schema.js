require('dotenv').config();
const { pool } = require('./database_pg');

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log("Columns in 'users' table:", res.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

checkSchema();
