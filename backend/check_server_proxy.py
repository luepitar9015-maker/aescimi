import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.8.164', username='cimi', password='Automatizador2026*')

print("--- WHATS ON PORT 80 ---")
stdin, stdout, stderr = ssh.exec_command("echo 'Automatizador2026*' | sudo -S ss -tlpn | grep ':80'")
print(stdout.read().decode())

print("--- WHATS ON PORT 3001, 3005, 3000 ---")
stdin, stdout, stderr = ssh.exec_command("echo 'Automatizador2026*' | sudo -S ss -tlpn | grep -E ':3001|:3005|:3000'")
print(stdout.read().decode())

print("--- ALL LISTEN ---")
stdin, stdout, stderr = ssh.exec_command("echo 'Automatizador2026*' | sudo -S ss -tlpn")
print(stdout.read().decode())

ssh.close()
