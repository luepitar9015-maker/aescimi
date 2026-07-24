import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_ssh():
    ip = "192.168.8.165"
    username = "cimi"
    passwords = ["Automatizador2026*", "Aut0m4t1z4d0r2026%*", "admin123", "admin2026"]
    
    for pwd in passwords:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            print(f"Trying SSH to {ip} with password: {pwd}...")
            ssh.connect(ip, username=username, password=pwd, timeout=5)
            print(f"SUCCESS! Connected with password: {pwd}")
            
            # Print network interfaces and listening ports
            stdin, stdout, stderr = ssh.exec_command("echo " + pwd + " | sudo -S ss -tlpn")
            print(stdout.read().decode('utf-8', errors='replace'))
            
            ssh.close()
            break
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == "__main__":
    test_ssh()
