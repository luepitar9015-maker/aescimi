import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def check_pm2():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado exitosamente por SSH a {ip}!")
    except Exception as e:
        print(f"Error al conectar por SSH a {ip}: {e}")
        return

    # 1. Run pm2 list
    print("\n===== Running PM2 status check =====")
    stdin, stdout, stderr = ssh.exec_command("pm2 list")
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("PM2 error:", err)

    # 2. Check for running node or database directories on 164
    print("\n===== Searching for .env and database.sqlite files on 192.168.8.164 =====")
    stdin, stdout, stderr = ssh.exec_command("find ~ -name '.env' -o -name 'database.sqlite' 2>/dev/null")
    paths = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
    paths = [p for p in paths if p]
    for p in paths:
        print("Found path:", p)
        if '.env' in p:
            stdin_env, stdout_env, stderr_env = ssh.exec_command(f"cat '{p}'")
            env_content = stdout_env.read().decode('utf-8', errors='replace')
            print(f"--- CONTENT OF {p} ---")
            print(env_content)

    ssh.close()

if __name__ == "__main__":
    check_pm2()
