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

    print("\n================ TODAS LAS TABLAS DE LA BD POSTGRESQL ================")
    cmd_tables = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT table_name FROM information_schema.tables WHERE table_schema='public';\""
    stdin, stdout, stderr = ssh.exec_command(cmd_tables)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ BUSCANDO ARCHIVOS DE LOGS / EXCEL / CSV EN EL SERVIDOR ================")
    cmd_find = "find /home/cimi /mnt/almacen /tmp -type f \\( -name '*.log' -o -name '*.csv' -o -name '*.json' -o -name '*.xlsx' -o -name '*.txt' \\) 2>/dev/null | grep -v 'node_modules' | grep -v '.git' | head -n 40"
    stdin, stdout, stderr = ssh.exec_command(cmd_find)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
