import paramiko
import sys
import io
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def run_remote_file(local_file_path):
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    filename = os.path.basename(local_file_path)
    remote_path = f"/home/cimi/aescimi/backend/{filename}"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error connecting to SSH: {e}")
        return

    # Upload file
    sftp = ssh.open_sftp()
    try:
        sftp.put(local_file_path, remote_path)
        print(f"Uploaded {local_file_path} to {remote_path}")
    finally:
        sftp.close()
        
    # Execute file
    print(f"Executing `node {filename}` on the server...")
    cmd = f"cd /home/cimi/aescimi/backend && node {filename}"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    print("\n--- STDOUT ---")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("--- STDERR ---")
        print(err)
        
    # Delete file
    ssh.exec_command(f"rm -f {remote_path}")
    ssh.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_remote_node.py <local_file_path>")
    else:
        run_remote_file(sys.argv[1])
