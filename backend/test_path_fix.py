import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_resolution():
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
        const res = await pool.query('SELECT id, filename, path, storage_path FROM documents WHERE id = 8');
        const doc = res.rows[0];
        console.log('Doc 8 db path:', doc.path);
        console.log('fs.existsSync(doc.path):', fs.existsSync(doc.path));

        // Try replacing 689224 with 9224
        const altPath1 = doc.path.replace('/689224/', '/9224/');
        console.log('altPath1 (replace /689224/ with /9224/):', altPath1);
        console.log('fs.existsSync(altPath1):', fs.existsSync(altPath1));

        // Try replacing 689224 with 68/9224
        const altPath2 = doc.path.replace('/689224/', '/68/9224/');
        console.log('altPath2 (replace /689224/ with /68/9224/):', altPath2);
        console.log('fs.existsSync(altPath2):', fs.existsSync(altPath2));

        // Check if file exists anywhere under /mnt/almacen with same filename
        const filename = path.basename(doc.path);
        const { execSync } = require('child_process');
        try {
            const findCmd = 'find /mnt/almacen -name \"' + filename + '\" 2>/dev/null';
            const matches = execSync(findCmd).toString().split('\\n').filter(Boolean);
            console.log('All matches in /mnt/almacen for filename:', matches);
        } catch(e) {
            console.error(e);
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
    test_resolution()
