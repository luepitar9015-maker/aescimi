import paramiko
import os

def inspect():
    hosts = ['192.168.8.165', '192.168.8.164']
    key_path = "C:/Users/Usuario/.ssh/id_rsa_sena"
    ssh = None

    for host in hosts:
        try:
            print(f"Testing SSH to {host}...")
            s = paramiko.SSHClient()
            s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            if os.path.exists(key_path):
                s.connect(host, username="cimi", key_filename=key_path, timeout=5)
            else:
                s.connect(host, username="cimi", password="Aut0m4t1z4d0r2026%*", timeout=5)
            print(f"Connected to {host}!")
            ssh = s
            break
        except Exception as e:
            try:
                s = paramiko.SSHClient()
                s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                s.connect(host, username="cimi", password="Aut0m4t1z4d0r2026%*", timeout=5)
                print(f"Connected to {host} via password!")
                ssh = s
                break
            except Exception as e2:
                print(f"Failed {host}: {e} / {e2}")

    if not ssh:
        print("Could not connect via SSH.")
        return

    print("\n--- Nginx Configuration ---")
    stdin, stdout, stderr = ssh.exec_command("echo 'Aut0m4t1z4d0r2026%*' | sudo -S cat /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null")
    print(stdout.read().decode('utf-8', errors='ignore'))

    print("\n--- PM2 List ---")
    stdin, stdout, stderr = ssh.exec_command("pm2 list")
    print(stdout.read().decode('utf-8', errors='ignore'))

    print("\n--- Dist Folder Listing ---")
    stdin, stdout, stderr = ssh.exec_command("ls -la /home/cimi/aescimi/frontend/dist /home/cimi/aescimi/frontend/dist/assets 2>/dev/null")
    print(stdout.read().decode('utf-8', errors='ignore'))

    ssh.close()

if __name__ == '__main__':
    inspect()
