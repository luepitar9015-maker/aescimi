import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def find_exact_doc8():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    cmd = "find /mnt/almacen -iname '*DERECHO DE PETICION.pdf*' 2>/dev/null"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("All files matching *DERECHO DE PETICION.pdf* in /mnt/almacen:")
    out = stdout.read().decode('utf-8')
    print(out[:3000]) # Print first 3000 chars

    ssh.close()

if __name__ == "__main__":
    find_exact_doc8()
