import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_all_dbs():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    db_password = "admin2026"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado a {ip}")
    except Exception as e:
        print(f"Error: {e}")
        return

    # Listar todas las bases de datos en postgres
    print("\n===== BASES DE DATOS EN EL POSTGRES DEL SERVIDOR =====")
    cmd = f"PGPASSWORD='{db_password}' psql -U postgres -h localhost -l"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("Error:", err)

    ssh.close()

if __name__ == "__main__":
    check_all_dbs()
