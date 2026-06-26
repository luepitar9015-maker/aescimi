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
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, username="cimi", password=password, timeout=10)
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)
        
    print("\n===== Checking journald.conf details =====")
    out, err = run_sudo_cmd(ssh, "ls -la /etc/systemd/journald.conf", password)
    print("ls output:", out, err)
    
    out, err = run_sudo_cmd(ssh, "cat /etc/systemd/journald.conf", password)
    print("cat stdout:", out)
    print("cat stderr:", err)
    
    # Let's write the configuration file /etc/systemd/journald.conf.d/99-limit-logs.conf
    # First, make the directory /etc/systemd/journald.conf.d if it doesn't exist
    print("\n===== Creating journald config directory =====")
    out, err = run_sudo_cmd(ssh, "mkdir -p /etc/systemd/journald.conf.d", password)
    print(out, err)
    
    # Write the limit logs config file
    print("\n===== Creating log limits config =====")
    config_content = "[Journal]\\nSystemMaxUse=100M\\n"
    out, err = run_sudo_cmd(ssh, f'echo -e "{config_content}" | sudo tee /etc/systemd/journald.conf.d/99-limit-logs.conf', password)
    print("tee output:", out, err)
    
    # Restart systemd-journald to apply the configuration
    print("\n===== Restarting systemd-journald =====")
    out, err = run_sudo_cmd(ssh, "systemctl restart systemd-journald", password)
    print(out, err)
    
    ssh.close()

if __name__ == "__main__":
    main()
