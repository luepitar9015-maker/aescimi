import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def view_logs():
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

    print("===== FILES IN ~/.pm2/logs/ =====")
    stdin, stdout, stderr = ssh.exec_command("ls -la ~/.pm2/logs/")
    print(stdout.read().decode('utf-8', errors='replace'))

    print("===== TAIL OF ALL ERROR LOGS =====")
    stdin, stdout, stderr = ssh.exec_command("tail -n 50 ~/.pm2/logs/*.log")
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    view_logs()
