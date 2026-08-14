import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_port_80():
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

    cmd = "curl -sI http://localhost:80/api/ades/view/6630"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("Headers for ID 6630 (Port 80):")
    print(stdout.read().decode('utf-8'))

    cmd8 = "curl -sI http://localhost:80/api/ades/view/8"
    stdin8, stdout8, stderr8 = ssh.exec_command(cmd8)
    print("Headers for ID 8 (Port 80):")
    print(stdout8.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    test_port_80()
