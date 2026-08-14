import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def update_expedientes():
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

    cmd = """cd /home/cimi/aescimi/backend && node -e '
    const { pool } = require("./database_pg");
    async function run() {
        const res = await pool.query(
            "UPDATE documents SET status = $1, load_date = NOW() WHERE expediente_id IN (SELECT id FROM expedientes WHERE expediente_code IN ($2, $3, $4)) RETURNING id, filename, status",
            ["Cargado", "2025EX-035882", "2025EX-035927", "2025EX-035894"]
        );
        console.log("Documentos actualizados a Cargado:", res.rows);
        process.exit(0);
    }
    run();
    ' """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    update_expedientes()
