require('dotenv').config();
const { pool } = require('./database_pg');
const bcrypt = require('bcryptjs');

async function checkAndFixSuperUser() {
  try {
    const res = await pool.query("SELECT id, document_no, role FROM users WHERE document_no = '1098680638'");
    console.log("Superuser query result:", res.rows);
    
    const hashedPassword = await bcrypt.hash('Santander2026**', 10);
    
    if (res.rows.length === 0) {
      console.log("Superuser not found. Creating it...");
      await pool.query(
        "INSERT INTO users (document_no, password_hash, role, full_name) VALUES ($1, $2, $3, $4)",
        ['1098680638', hashedPassword, 'superadmin', 'Super Administrador']
      );
      console.log("Superuser created successfully!");
    } else {
      console.log("Superuser found. Resetting password just in case...");
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE document_no = '1098680638'",
        [hashedPassword]
      );
      console.log("Superuser password reset successfully!");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

checkAndFixSuperUser();
