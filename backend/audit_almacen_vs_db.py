import paramiko
import sys
import io
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    db_password = "admin2026"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado a {ip}")
    except Exception as e:
        print(f"Error: {e}")
        return

    # 1. Obtener los expedientes de la base de datos Postgres
    print("\n===== Leyendo expedientes de la base de datos Postgres =====")
    cmd_db = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -c \"COPY (SELECT id, expediente_code, title, subserie FROM expedientes) TO STDOUT WITH CSV HEADER;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_db)
    db_output = stdout.read().decode('utf-8', errors='replace')
    
    db_expedientes = []
    lines = db_output.strip().split('\n')
    if len(lines) > 1:
        # Parsear CSV simple
        header = lines[0].split(',')
        for line in lines[1:]:
            parts = line.split(',')
            if len(parts) >= 3:
                db_expedientes.append({
                    'id': parts[0],
                    'code': parts[1],
                    'title': parts[2]
                })
    print(f"Total expedientes en BD: {len(db_expedientes)}")

    # 2. Listar carpetas en el almacenamiento físico /mnt/almacen
    # Usaremos find para obtener todos los directorios de nivel 3 (Regional > Centro > Dependencia > Serie > Expediente/Metadato)
    # y contar cuántas carpetas de expedientes hay en total.
    print("\n===== Escaneando carpetas físicas en /mnt/almacen =====")
    
    # Vamos a buscar carpetas a profundidades de 3 a 5 niveles
    cmd_find_dirs = "find /mnt/almacen -type d"
    stdin, stdout, stderr = ssh.exec_command(cmd_find_dirs)
    all_dirs = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
    all_dirs = [d for d in all_dirs if d and d != '/mnt/almacen']
    
    print(f"Total de directorios físicos encontrados en /mnt/almacen: {len(all_dirs)}")
    
    # Veamos las carpetas de último nivel que típicamente contienen archivos PDF
    # Encontraremos directorios que contienen directamente archivos PDF
    cmd_dirs_with_pdfs = "find /mnt/almacen -type f -name '*.pdf' -exec dirname {} \\; | sort -u"
    stdin, stdout, stderr = ssh.exec_command(cmd_dirs_with_pdfs)
    dirs_with_pdfs = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
    dirs_with_pdfs = [d for d in dirs_with_pdfs if d]
    
    print(f"Total de carpetas físicas que contienen PDFs (expedientes con documentos): {len(dirs_with_pdfs)}")
    
    # Mostrar las primeras 15 carpetas que contienen archivos PDF
    print("\nEjemplo de las primeras 15 carpetas físicas con PDFs:")
    for d in dirs_with_pdfs[:15]:
        # Contar cuántos PDFs hay en este directorio
        stdin, stdout, stderr = ssh.exec_command(f"find '{d}' -maxdepth 1 -type f -name '*.pdf' | wc -l")
        pdf_count = stdout.read().decode('utf-8').strip()
        print(f" - {d} ({pdf_count} PDFs)")

    # 3. Comprobar si los expedientes de la BD coinciden con las carpetas
    # Ver si los códigos o títulos de la BD están en las rutas de los directorios
    matched_count = 0
    unmatched_dirs = []
    
    for dir_path in dirs_with_pdfs:
        folder_name = dir_path.split('/')[-1]
        # Buscar si esta carpeta corresponde a algún expediente de la base de datos
        found = False
        for exp in db_expedientes:
            clean_title = exp['title'].replace(' ', '_').replace('/', '_')
            if exp['code'] in folder_name or clean_title in folder_name:
                found = True
                break
        if found:
            matched_count += 1
        else:
            unmatched_dirs.append(dir_path)
            
    print(f"\nCarpetas que coinciden con registros en BD: {matched_count}")
    print(f"Carpetas que NO coinciden con registros en BD (descolgadas): {len(unmatched_dirs)}")
    
    if unmatched_dirs:
        print("\nEjemplo de las primeras 15 carpetas descolgadas (sin registro en BD):")
        for d in unmatched_dirs[:15]:
            stdin, stdout, stderr = ssh.exec_command(f"find '{d}' -maxdepth 1 -type f -name '*.pdf' | wc -l")
            pdf_count = stdout.read().decode('utf-8').strip()
            print(f" - {d} ({pdf_count} PDFs)")

    ssh.close()

if __name__ == "__main__":
    main()
