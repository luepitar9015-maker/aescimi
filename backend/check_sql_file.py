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

    # Comprobar el tamaño y las primeras 30 líneas de fix_sin_titulo.sql
    cmd = "ls -lh /home/cimi/aescimi/backend/fix_sin_titulo.sql && head -n 30 /home/cimi/aescimi/backend/fix_sin_titulo.sql"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    
    ssh.close()

if __name__ == "__main__":
    main()
