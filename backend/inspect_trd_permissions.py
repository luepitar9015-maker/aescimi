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

    print("\n================ TABLA user_trd_permissions ================")
    cmd_perm = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT utp.id, utp.user_id, u.full_name, utp.series_id, ts.series_code, ts.series_name FROM user_trd_permissions utp JOIN users u ON u.id = utp.user_id JOIN trd_series ts ON ts.id = utp.series_id;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_perm)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ SUBSERIES Y SUS NOMBRES ================")
    cmd_subnames = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT id, series_id, subseries_code, subseries_name FROM trd_subseries;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_subnames)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
