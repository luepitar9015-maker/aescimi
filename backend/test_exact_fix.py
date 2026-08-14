import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_exact_path_fix():
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

    function resolvePath(p) {
        if (!p) return null;
        if (fs.existsSync(p)) return p;

        // Replace /689224/ at the beginning of storage with /9224/
        let p1 = p.replace('/mnt/almacen/689224/', '/mnt/almacen/9224/');
        if (fs.existsSync(p1)) return p1;

        // Replace any /689224/ with /9224/
        let p2 = p.replace('/689224/', '/9224/');
        if (fs.existsSync(p2)) return p2;

        // Replace /689224/ with /68/9224/
        let p3 = p.replace('/689224/', '/68/9224/');
        if (fs.existsSync(p3)) return p3;

        return null;
    }

    async function run() {
        const res = await pool.query('SELECT id, path FROM documents WHERE id IN (7, 8, 1, 2, 3, 4, 5, 6)');
        for (const row of res.rows) {
            const resolved = resolvePath(row.path);
            console.log('Doc ID:', row.id, '| DB path:', row.path, '| Resolved:', resolved, '| Exists:', !!resolved);
        }
        process.exit(0);
    }
    run();
    " """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    test_exact_path_fix()
