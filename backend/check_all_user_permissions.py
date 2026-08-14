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

    print("\n================ PERMISOS TRD Y ROL DE TODOS LOS USUARIOS ================")
    cmd_all_p = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT u.id, u.full_name, u.role, ts.series_code, ts.series_name
    FROM users u
    LEFT JOIN user_trd_permissions utp ON utp.user_id = u.id
    LEFT JOIN trd_series ts ON ts.id = utp.series_id
    ORDER BY u.id;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_all_p)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
