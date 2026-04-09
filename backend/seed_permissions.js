require('dotenv').config();
const { pool } = require('./database_pg');

const MODULES = [
    'dashboard','trd','expedientes','documents','query',
    'mass-upload','cargue-aes','letters','onedrive',
    'config-aes','automation','users','permissions'
];
const defaults = {
    admin: MODULES, // admin sees everything
    user:  ['dashboard','trd','expedientes','documents','query','cargue-aes','letters']
};

async function run() {
    for (const [role, visible] of Object.entries(defaults)) {
        await pool.query('DELETE FROM role_permissions WHERE role_name = $1', [role]);
        for (const m of MODULES) {
            await pool.query(
                'INSERT INTO role_permissions (role_name, module_id, can_view) VALUES ($1,$2,$3)',
                [role, m, visible.includes(m) ? 1 : 0]
            );
        }
        console.log(`Seeded ${MODULES.length} modules for role: ${role}`);
    }
    console.log('Done!');
    await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
