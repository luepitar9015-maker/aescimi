import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_doc():
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

    cmd_node = """node -e "const { pool } = require('/home/cimi/aescimi/backend/database_pg.js'); pool.query('SELECT id, filename, path, storage_path FROM documents WHERE id = 8').then(r => { console.log('DOC 8:', r.rows); return pool.query('SELECT id, filename, path, storage_path FROM documents ORDER BY id DESC LIMIT 5'); }).then(r => { console.log('RECENT DOCS:', r.rows); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });" """
    
    stdin, stdout, stderr = ssh.exec_command(cmd_node)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_doc()
