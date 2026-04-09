const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    password: 'admin123',
    port: 5000,
    database: 'sena_db',
};

async function diagnose() {
    const db = new Client(pgConfig);
    try {
        await db.connect();
        console.log("--- DIAGNÓSTICO DE USUARIOS ---");
        
        const res = await db.query("SELECT id, full_name, document_no, role FROM users");
        console.log(`Total usuarios encontrados: ${res.rowCount}`);
        res.rows.forEach(u => {
            console.log(`- ID: ${u.id}, Doc: ${u.document_no}, Nombre: ${u.full_name}, Rol: ${u.role}`);
        });

        // Reset password for the specific user in the screenshot
        const targetDoc = '1098680638';
        const newPass = 'admin123';
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(newPass, salt);

        console.log(`\nReseteando contraseña para ${targetDoc} a '${newPass}'...`);
        const updateRes = await db.query("UPDATE users SET password_hash = $1 WHERE document_no = $2", [hash, targetDoc]);
        
        if (updateRes.rowCount > 0) {
            console.log("¡Contraseña reseteada con éxito!");
        } else {
            console.log("ADVERTENCIA: No se pudo encontrar al usuario para resetear la contraseña.");
            console.log("Creándolo como superadmin...");
            await db.query(`INSERT INTO users (full_name, document_no, password_hash, role) 
                            VALUES ('Luis Ernesto Parada Moreno', $1, $2, 'superadmin')`, 
                            [targetDoc, hash]);
            console.log("Usuario creado.");
        }

    } catch (err) {
        console.error("ERROR DE CONEXIÓN O SQL:", err.message);
    } finally {
        await db.end();
    }
}

diagnose();
