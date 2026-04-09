const pool = require('./database_pg').pool;
const bcrypt = require('bcryptjs');

async function seedSuperuser() {
    const fullName = 'Luis Ernesto Parada Moreno';
    const documentNo = '1098680638';
    const position = 'Gestión Documental';
    const password = 'Santander2026**';
    const area = 'Administración';
    const email = 'luis.parada@sena.edu.co';
    const role = 'superadmin';

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    try {
        console.log(`Seeding superuser: ${fullName}...`);
        await pool.query(
            `INSERT INTO users (full_name, document_no, position, password_hash, area, email, role) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (document_no) DO UPDATE 
             SET full_name = EXCLUDED.full_name, 
                 position = EXCLUDED.position, 
                 password_hash = EXCLUDED.password_hash, 
                 role = EXCLUDED.role`,
            [fullName, documentNo, position, hash, area, email, role]
        );
        console.log("Superuser seeded successfully.");

        // Also ensure system settings for expiration
        await pool.query(
            "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
            ['system_expiration_date', '2030-12-31'] // Default far future
        );
        
        // Ensure superadmin permissions for all modules
        const modules = [
            'dashboard', 'trd', 'expedientes', 'documents', 'query', 
            'mass-upload', 'cargue-aes', 'letters', 'onedrive', 
            'config-aes', 'automation', 'users', 'permissions', 'trd_query', 'superuser_module'
        ];

        for (const mod of modules) {
            await pool.query(
                "INSERT INTO role_permissions (role_name, module_id, can_view) VALUES ($1, $2, $3) ON CONFLICT (role_name, module_id) DO UPDATE SET can_view = 1",
                ['superadmin', mod, 1]
            );
        }
        console.log("Superadmin permissions updated.");

    } catch (e) {
        console.error("Error seeding superuser:", e.message);
    } finally {
        pool.end();
    }
}

seedSuperuser();
