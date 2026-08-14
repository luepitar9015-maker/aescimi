import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_expedientes():
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
    pool.query("SELECT e.expediente_code, d.id as doc_id, d.filename, d.status, d.load_date FROM expedientes e JOIN documents d ON d.expediente_id = e.id WHERE e.expediente_code IN ($1, $2, $3)", ["2025EX-035882", "2025EX-035927", "2025EX-035894"])
    .then(r => { console.log(r.rows); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
    ' """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_expedientes()
