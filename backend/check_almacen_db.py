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

    print("===== BUSCANDO ARCHIVOS DE BASE DE DATOS EN /mnt/almacen =====")
    stdin, stdout, stderr = ssh.exec_command("find /mnt/almacen -name '*.sqlite' -o -name '*.db' -o -name '*.sql' 2>/dev/null")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    ssh.close()

if __name__ == "__main__":
    main()
