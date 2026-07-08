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

    # Contar archivos físicos en uploads
    paths = [
        "/home/cimi/INSTALADOR_SENA/backend/uploads",
        "/home/cimi/aescimi/backend/uploads"
    ]
    
    for path in paths:
        print(f"\n===== Analizando {path} =====")
        # Verificar si la carpeta existe
        stdin, stdout, stderr = ssh.exec_command(f"[ -d '{path}' ] && echo 'Existe' || echo 'No existe'")
        exists = stdout.read().decode('utf-8').strip()
        if exists == 'No existe':
            print("La carpeta no existe.")
            continue
            
        # Contar archivos pdf, docx, xlsx, etc.
        cmd_count_all = f"find '{path}' -type f | wc -l"
        stdin, stdout, stderr = ssh.exec_command(cmd_count_all)
        total_files = stdout.read().decode('utf-8').strip()
        print(f"Total de archivos físicos (cualquier tipo): {total_files}")
        
        cmd_count_pdf = f"find '{path}' -name '*.pdf' | wc -l"
        stdin, stdout, stderr = ssh.exec_command(cmd_count_pdf)
        pdf_files = stdout.read().decode('utf-8').strip()
        print(f"Archivos PDF: {pdf_files}")
        
        # Mostrar subcarpetas principales
        print("\nSubcarpetas y archivos en el primer nivel:")
        cmd_subdirs = f"ls -lh '{path}'"
        stdin, stdout, stderr = ssh.exec_command(cmd_subdirs)
        print(stdout.read().decode('utf-8'))

    # También buscar si hay carpetas de OneDrive o compartidas en /mnt o /media
    print("\n===== Revisando puntos de montaje y discos =====")
    stdin, stdout, stderr = ssh.exec_command("df -h")
    print(stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
