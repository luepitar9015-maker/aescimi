import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_all_paths():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    cmd = """node -e "
    const fs = require('fs');
    const path = require('path');
    const { pool } = require('/home/cimi/aescimi/backend/database_pg.js');

    async function run() {
        const res = await pool.query('SELECT id, path FROM documents WHERE path IS NOT NULL LIMIT 500');
        let directExists = 0;
        let fixedExists = 0;
        let missing = 0;

        for (const row of res.rows) {
            if (fs.existsSync(row.path)) {
                directExists++;
            } else {
                const fixed = row.path.replace('/mnt/almacen/689224/', '/mnt/almacen/9224/').replace('/689224/', '/9224/');
                if (fs.existsSync(fixed)) {
                    fixedExists++;
                } else {
                    missing++;
                }
            }
        }

        console.log('Tested 500 records:');
        console.log('Direct Exists:', directExists);
        console.log('Fixed Exists (with 689224 -> 9224 replacement):', fixedExists);
        console.log('Missing:', missing);

        process.exit(0);
    }
    run();
    " """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_all_paths()
