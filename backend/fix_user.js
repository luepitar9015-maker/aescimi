const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'sena_db',
};

async function fixUser() {
    const db = new Client(pgConfig);
    try {
        await db.connect();
        
        const documentNo = '1098680638';
        const newPassword = 'admin123';
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(newPassword, salt);

        // Check if user exists
        const res = await db.query("SELECT * FROM users WHERE document_no = $1", [documentNo]);
        
        if (res.rowCount > 0) {
            console.log(`Usuario ${documentNo} encontrado. Actualizando contraseña a 'admin123'...`);
            await db.query("UPDATE users SET password_hash = $1 WHERE document_no = $2", [hash, documentNo]);
            console.log("Contraseña actualizada exitosamente.");
        } else {
            console.log(`Usuario ${documentNo} no encontrado en PostgreSQL.`);
            // Maybe try creating him as superadmin if he's missing
            console.log("Creando usuario como superadmin...");
            await db.query(
                "INSERT INTO users (full_name, document_no, password_hash, role) VALUES ($1, $2, $3, $4)",
                ['Luis Ernesto Parada Moreno', documentNo, hash, 'superadmin']
            );
            console.log("Usuario creado exitosamente.");
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await db.end();
    }
}

fixUser();
