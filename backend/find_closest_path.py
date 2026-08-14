import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_closest():
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

    # Check if folder 72025002358 exists anywhere
    cmd1 = "find /mnt/almacen -name '*72025002358*' 2>/dev/null"
    stdin, stdout, stderr = ssh.exec_command(cmd1)
    print("Search for 72025002358 in /mnt/almacen:")
    out1 = stdout.read().decode('utf-8')
    print(out1 if out1.strip() else "NOT FOUND")

    # Search for folder 7202500* under 68922427
    cmd2 = "ls -d /mnt/almacen/9224/68922427/7202500* 2>/dev/null | head -n 30"
    stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
    print("\nFolders matching 7202500*:")
    print(stdout2.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_closest()
