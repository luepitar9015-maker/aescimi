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

    print("\n================ RECUENTO FINAL DE ASIGNACIONES POR USUARIO ================")
    cmd_count = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT u.id, u.full_name, u.role, COUNT(ea.id) as total_asignados
    FROM users u
    LEFT JOIN expediente_assignments ea ON ea.user_id = u.id
    GROUP BY u.id, u.full_name, u.role
    HAVING COUNT(ea.id) > 0 OR u.id IN (4, 19, 21, 33)
    ORDER BY u.id;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_count)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
