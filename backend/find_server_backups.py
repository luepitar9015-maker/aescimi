import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

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

    # Buscar archivos de respaldo en el servidor (.sql, .dump, .sqlite, .backup)
    search_paths = [
        "/home/cimi",
        "/home/cimi/aescimi",
        "/mnt/almacen"
    ]
    
    print("=== BUSCANDO ARCHIVOS DE BACKUP EN EL SERVIDOR ===")
    for path in search_paths:
        print(f"\nBuscando en: {path}...")
        cmd = f"find {path} -maxdepth 3 -type f \\( -name '*.sql' -o -name '*.dump' -o -name '*.sqlite*' -o -name '*.backup' \\) 2>/dev/null"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        res = stdout.read().decode('utf-8', errors='replace').strip()
        if res:
            print(res)
        else:
            print("Ninguno encontrado.")
            
    ssh.close()

if __name__ == "__main__":
    main()
