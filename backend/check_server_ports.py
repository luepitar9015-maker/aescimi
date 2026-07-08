import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def run_sudo_cmd(ssh, cmd, password):
    full_cmd = f'echo "{password}" | sudo -S {cmd}'
    stdin, stdout, stderr = ssh.exec_command(full_cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

def main():
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

    print("===== PUERTOS ESCUCHANDO EN EL SERVIDOR 192.168.8.164 =====")
    out, err = run_sudo_cmd(ssh, "ss -tlnp", password)
    print(out)
    if err:
        print("Error:", err)
        
    ssh.close()

if __name__ == "__main__":
    main()
