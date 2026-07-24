import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def view_nginx():
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

    print("===== FILES IN /etc/nginx/sites-enabled/ =====")
    stdin, stdout, stderr = ssh.exec_command("ls -la /etc/nginx/sites-enabled/")
    print(stdout.read().decode('utf-8', errors='replace'))

    print("===== NGINX CONF FOR AESCIMI =====")
    stdin, stdout, stderr = ssh.exec_command("cat /etc/nginx/sites-enabled/* 2>/dev/null || cat /etc/nginx/conf.d/* 2>/dev/null")
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    view_nginx()
