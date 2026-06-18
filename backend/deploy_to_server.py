import paramiko
import sys

def deploy():
    hostname = "192.168.8.165"
    username = "cimi"
    key_path = "C:/Users/Usuario/.ssh/id_rsa_sena"
    print(f"Connecting to {hostname} via SSH using key {key_path}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password="Aut0m4t1z4d0r2026%*", timeout=10)
        print("Connected successfully via password!")
    except Exception as e:
        try:
            ssh.connect(hostname, username=username, key_filename=key_path, timeout=10)
            print("Connected successfully via key!")
        except Exception as e_key:
            print(f"Connection failed: password auth error: {e}, key auth error: {e_key}")
            return False

    # Find the repository folder
    print("Finding the update script on the server...")
    stdin, stdout, stderr = ssh.exec_command("find ~ -name 'ACTUALIZAR_DESDE_GITHUB_LINUX.sh' 2>/dev/null")
    paths = stdout.read().decode('utf-8').strip().split('\n')
    paths = [p for p in paths if p]
    
    if not paths:
        print("Error: Could not find 'ACTUALIZAR_DESDE_GITHUB_LINUX.sh' in home directory.")
        ssh.close()
        return False
        
    script_path = paths[0]
    import os
    # Get the directory part
    script_dir = script_path.rsplit('/', 1)[0] if '/' in script_path else '.'
    print(f"Found script at: {script_path}")
    print(f"Directory: {script_dir}")
    
    # Run the update script
    cmd = f"cd {script_dir} && chmod +x ACTUALIZAR_DESDE_GITHUB_LINUX.sh && ./ACTUALIZAR_DESDE_GITHUB_LINUX.sh"
    print(f"Running command: {cmd}")
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    # Print the output in real-time
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end="")
        
    err = stderr.read().decode('utf-8')
    if err:
        print("\nStderr:")
        print(err)
        
    print("\nDeployment finished.")
    ssh.close()
    return True

if __name__ == "__main__":
    deploy()
