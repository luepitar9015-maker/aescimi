import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_expediente_8():
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
    const { pool } = require('/home/cimi/aescimi/backend/database_pg.js');

    async function run() {
        const expRes = await pool.query('SELECT * FROM expedientes WHERE id = 3');
        console.log('Expediente ID 3 details:', expRes.rows[0]);

        const docRes = await pool.query('SELECT id, filename, path FROM documents WHERE expediente_id = 3');
        console.log('Docs for Exp 3:', docRes.rows);

        process.exit(0);
    }
    run();
    " """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    # También ejecutar un find en bash directamente
    cmd_bash = 'find /mnt/almacen -name "01_DERECHO DE PETICION.pdf" 2>/dev/null | grep "72025002358"'
    stdin2, stdout2, stderr2 = ssh.exec_command(cmd_bash)
    print("\nBash search for 72025002358:")
    print(stdout2.read().decode('utf-8'))

    cmd_bash2 = 'find /mnt/almacen -name "*72025002358*" 2>/dev/null'
    stdin3, stdout3, stderr3 = ssh.exec_command(cmd_bash2)
    print("\nBash search for folder 72025002358:")
    print(stdout3.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_expediente_8()
