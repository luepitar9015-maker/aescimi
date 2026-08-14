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
        print(f"Conectado a {ip}")
    except Exception as e:
        print(f"Error SSH: {e}")
        return

    print("\n================ EJECUTANDO SYNCHRONIZE DE CARPETAS /mnt/almacen A BASE DE DATOS ================")
    cmd_sync = "cd /home/cimi/aescimi/backend && node sync_storage_to_db.js"
    stdin, stdout, stderr = ssh.exec_command(cmd_sync)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ CONTEO DE DOCUMENTOS POR STATUS TRAS LA SINCRONIZACIÓN ================")
    cmd_status = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT status, COUNT(*) FROM documents GROUP BY status;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_status)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
