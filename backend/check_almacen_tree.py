import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_almacen_structure():
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

    cmd = "ls -la /mnt/almacen"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("Contents of /mnt/almacen:")
    print(stdout.read().decode('utf-8'))

    # Check child folders recursively (up to 3 levels)
    cmd_tree = "find /mnt/almacen -maxdepth 3 -type d"
    stdin2, stdout2, stderr2 = ssh.exec_command(cmd_tree)
    print("\nDirectory tree of /mnt/almacen (depth 3):")
    print(stdout2.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    check_almacen_structure()
