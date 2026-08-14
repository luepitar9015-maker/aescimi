import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_auto_resolution():
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

    function resolveFilePath(targetPath) {
        if (!targetPath) return null;
        if (fs.existsSync(targetPath)) return targetPath;

        // Variations
        const variations = [
            targetPath.replace('/689224/', '/9224/'),
            targetPath.replace('/689224/', '/68/9224/'),
            targetPath.replace('/mnt/almacen/689224/', '/mnt/almacen/9224/'),
            targetPath.replace('/mnt/almacen/689224/', '/mnt/almacen/')
        ];

        for (const v of variations) {
            if (fs.existsSync(v)) return v;
        }

        // Search in /mnt/almacen by relative subpath
        const filename = path.basename(targetPath);
        const parts = targetPath.split('/');
        const folderName = parts[parts.length - 2]; // e.g. 72025002358

        if (folderName && filename) {
            const candidate1 = '/mnt/almacen/9224/' + parts.slice(-3).join('/');
            if (fs.existsSync(candidate1)) return candidate1;

            const candidate2 = '/mnt/almacen/9224/68922427/' + folderName + '/' + filename;
            if (fs.existsSync(candidate2)) return candidate2;
        }

        return null;
    }

    async function run() {
        const res = await pool.query('SELECT id, path FROM documents WHERE id = 8');
        const doc = res.rows[0];
        console.log('Original path:', doc.path);
        const resolved = resolveFilePath(doc.path);
        console.log('Resolved path:', resolved);
        console.log('Exists:', resolved ? fs.existsSync(resolved) : false);

        process.exit(0);
    }
    run();
    " """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    test_auto_resolution()
