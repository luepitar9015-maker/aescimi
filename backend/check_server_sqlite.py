import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error: {e}")
        return

    # Escribir script en el servidor remoto
    remote_script_path = "/tmp/count_sqlite.py"
    script_content = """
import sqlite3
import os

paths = [
    "/home/cimi/aescimi/backend/database.sqlite",
    "/home/cimi/INSTALADOR_SENA/backend/database.sqlite"
]

for p in paths:
    print(f"=== {p} ===")
    if not os.path.exists(p):
        print("No existe")
        continue
    try:
        conn = sqlite3.connect(p)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print("Tablas:", tables)
        for t in tables:
            try:
                cursor.execute(f'SELECT COUNT(*) FROM "{t}";')
                print(f"  {t}: {cursor.fetchone()[0]}")
            except Exception as e:
                print(f"  {t}: Error {e}")
        conn.close()
    except Exception as ex:
        print("Error leyendo DB:", ex)
"""
    
    # Crear archivo remoto
    sftp = ssh.open_sftp()
    with sftp.open(remote_script_path, 'w') as f:
        f.write(script_content)
    sftp.close()
    
    # Ejecutar script remoto
    stdin, stdout, stderr = ssh.exec_command(f"python3 {remote_script_path}")
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("Stderr remote:", err)
        
    # Limpiar script
    ssh.exec_command(f"rm -f {remote_script_path}")
    ssh.close()

if __name__ == "__main__":
    main()
