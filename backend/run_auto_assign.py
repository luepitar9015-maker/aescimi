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
        print(f"Conectado exitosamente a {ip}")
    except Exception as e:
        print(f"Error SSH: {e}")
        return

    commands = [
        "cd /home/cimi/aescimi && git pull origin main",
        "cd /home/cimi/aescimi/backend && node auto_assign_by_permissions.js",
        "pm2 restart all"
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

    # Verificar asignaciones en postgres
    print("\n---> Verificando conteo de asignaciones por usuario en PostgreSQL...")
    check_sql = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c 'SELECT u.id, u.full_name, u.role, COUNT(ea.id) as asignaciones FROM users u LEFT JOIN expediente_assignments ea ON ea.user_id = u.id GROUP BY u.id, u.full_name, u.role ORDER BY u.id;'"
    stdin, stdout, stderr = ssh.exec_command(check_sql)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
