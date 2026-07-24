import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_firewall():
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

    print("===== UFW STATUS =====")
    stdin, stdout, stderr = ssh.exec_command(f"echo '{password}' | sudo -S ufw status")
    print(stdout.read().decode('utf-8', errors='replace'))

    print("===== ALLOWING PORTS 3000 AND 3005 =====")
    stdin, stdout, stderr = ssh.exec_command(f"echo '{password}' | sudo -S ufw allow 3000/tcp && echo '{password}' | sudo -S ufw allow 3005/tcp && echo '{password}' | sudo -S ufw reload")
    print(stdout.read().decode('utf-8', errors='replace'))

    print("===== IPTABLES RULES FOR PORT 3000 =====")
    stdin, stdout, stderr = ssh.exec_command(f"echo '{password}' | sudo -S iptables -L -n -v | grep -E '3000|3005'")
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    check_firewall()
