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
        print(f"Conectado a {ip}")
    except Exception as e:
        print(f"Error: {e}")
        return

    path = "/mnt/almacen"
    print(f"\n===== Analizando {path} =====")
    
    # Contar archivos físicos
    cmd_count_all = f"find '{path}' -type f | wc -l"
    stdin, stdout, stderr = ssh.exec_command(cmd_count_all)
    total_files = stdout.read().decode('utf-8').strip()
    print(f"Total de archivos físicos en {path}: {total_files}")
    
    cmd_count_pdf = f"find '{path}' -name '*.pdf' | wc -l"
    stdin, stdout, stderr = ssh.exec_command(cmd_count_pdf)
    pdf_files = stdout.read().decode('utf-8').strip()
    print(f"Archivos PDF en {path}: {pdf_files}")
    
    cmd_count_dirs = f"find '{path}' -type d | wc -l"
    stdin, stdout, stderr = ssh.exec_command(cmd_count_dirs)
    total_dirs = stdout.read().decode('utf-8').strip()
    print(f"Total de carpetas físicas en {path}: {total_dirs}")

    print("\nPrimer nivel de carpetas/archivos en /mnt/almacen:")
    cmd_ls = f"ls -lh '{path}'"
    stdin, stdout, stderr = ssh.exec_command(cmd_ls)
    print(stdout.read().decode('utf-8'))

    # Ver si hay una subcarpeta como "Gestion_Documental" o similar
    stdin, stdout, stderr = ssh.exec_command(f"find '{path}' -maxdepth 2 -type d")
    print("\nEstructura de subdirectorios (maxdepth 2):")
    print(stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
