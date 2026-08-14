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

    commands = [
        "cd /home/cimi/aescimi && git pull origin main",
        "cd /home/cimi/aescimi/backend && node sync_all_almacen.js"
    ]

    for cmd in commands:
        print(f"\n---> Ejecutando: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            print("STDOUT:\n", out)
        if err:
            print("STDERR:\n", err)

    print("\n================ VERIFICACIÓN DE DOCUMENTOS EN BD TRAS ESCANEO COMPLETO ================")
    cmd_stat = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT e.subserie, d.status, COUNT(d.id) FROM expedientes e JOIN documents d ON d.expediente_id = e.id GROUP BY e.subserie, d.status;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_stat)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
