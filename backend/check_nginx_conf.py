import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.8.164', username='cimi', password='Automatizador2026*')

print("--- NGINX CONFIG FILES ---")
stdin, stdout, stderr = ssh.exec_command("echo 'Automatizador2026*' | sudo -S grep -rnw '/etc/nginx/' -e 'proxy_pass' 2>/dev/null")
print(stdout.read().decode())

print("--- SEARCH FOR aescimi IN NGINX ---")
stdin, stdout, stderr = ssh.exec_command("echo 'Automatizador2026*' | sudo -S grep -rnw '/etc/nginx/' -e 'aescimi' 2>/dev/null")
print(stdout.read().decode())

ssh.close()
