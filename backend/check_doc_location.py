import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_paths():
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

    cmd = """find /home /mnt /media /opt /var -name "*01_DERECHO DE PETICION.pdf*" 2>/dev/null"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    print("Find result:")
    print(out)

    # También verificar /mnt/almacen y carpetas uploads
    cmd_ls = "ls -la /mnt 2>/dev/null; ls -la /home/cimi/aescimi/backend/uploads 2>/dev/null"
    stdin2, stdout2, stderr2 = ssh.exec_command(cmd_ls)
    print("\nListing /mnt and uploads:")
    print(stdout2.read().decode('utf-8'))

    # Verificar system_settings storage_path
    cmd_settings = """node -e "const { pool } = require('/home/cimi/aescimi/backend/database_pg.js'); pool.query('SELECT * FROM system_settings').then(r => { console.log('SETTINGS:', r.rows); process.exit(0); });" """
    stdin3, stdout3, stderr3 = ssh.exec_command(cmd_settings)
    print("\nSystem Settings:")
    print(stdout3.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_paths()
