import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def search_system():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    # Search across system for 72025002358
    cmd1 = "find / -name '*72025002358*' 2>/dev/null"
    stdin, stdout, stderr = ssh.exec_command(cmd1)
    print("System search for 72025002358:")
    print(stdout.read().decode('utf-8'))

    # Search for files with '01_DERECHO DE PETICION' in /home/cimi or /mnt or /var
    cmd2 = "find /home /mnt /var /tmp /opt -name '*01_DERECHO DE PETICION*' 2>/dev/null | head -n 30"
    stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
    print("\nHead 30 files matching *01_DERECHO DE PETICION*:")
    print(stdout2.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    search_system()
