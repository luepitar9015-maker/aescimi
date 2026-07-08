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
    except Exception as e:
        print(f"Error: {e}")
        return

    # 1. Obtener todos los expedientes de la BD (con sus metadatos)
    print("Obteniendo expedientes de la base de datos...")
    cmd_db = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -c \"COPY (SELECT id, title, subserie, metadata_values FROM expedientes) TO STDOUT WITH CSV HEADER;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_db)
    db_output = stdout.read().decode('utf-8', errors='replace')
    
    db_expedientes = []
    lines = db_output.strip().split('\n')
    if len(lines) > 1:
        # Parsear CSV simple
        for line in lines[1:]:
            parts = line.split(',')
            if len(parts) >= 4:
                # El último elemento suele ser el JSON de metadata
                metadata_str = ",".join(parts[3:])
                # Quitar comillas si las tiene
                if metadata_str.startswith('"') and metadata_str.endswith('"'):
                    metadata_str = metadata_str[1:-1].replace('""', '"')
                
                meta_vals = {}
                try:
                    meta_vals = json.loads(metadata_str)
                except Exception:
                    pass
                
                db_expedientes.append({
                    'id': parts[0],
                    'title': parts[1].strip(),
                    'subserie': parts[2].strip(),
                    'metadata': meta_vals
                })
                
    print(f"Total expedientes en base de datos: {len(db_expedientes)}")

    # 2. Escanear directorios físicos con PDFs
    print("\nEscaneando carpetas con PDFs en /mnt/almacen...")
    cmd_dirs = "find /mnt/almacen -type f -name '*.pdf' -exec dirname {} \\; | sort -u"
    stdin, stdout, stderr = ssh.exec_command(cmd_dirs)
    physical_dirs = stdout.read().decode('utf-8', errors='replace').strip().split('\n')
    physical_dirs = [d for d in physical_dirs if d]
    print(f"Total de carpetas con PDFs en disco: {len(physical_dirs)}")

    # 3. Comparar de manera estricta
    missing_directories = []
    
    for dir_path in physical_dirs:
        # Extraer partes de la ruta
        # Ej: /mnt/almacen/689224/68922437/3139626/CC 1116182456
        parts = dir_path.replace('/mnt/almacen/', '').split('/')
        
        # El nombre final suele ser el título o metadato clave (ej: "CC 1116182456")
        final_folder_name = parts[-1]
        
        # También buscar en toda la ruta si contiene algún valor de identificación
        # Buscaremos si algún valor de los metadatos o código de la BD coincide exactamente
        found_in_db = False
        for exp in db_expedientes:
            # Buscar coincidencia en título
            if exp['title'] != 'Sin Título' and exp['title'] and (exp['title'] in dir_path or dir_path.endswith(exp['title'].replace(' ', '_'))):
                found_in_db = True
                break
                
            # Buscar en los metadatos (valor1, valor4, etc.)
            meta_match = False
            for k, v in exp['metadata'].items():
                if v and str(v).strip() and str(v).strip() in dir_path:
                    meta_match = True
                    break
            if meta_match:
                found_in_db = True
                break
                
        if not found_in_db:
            missing_directories.append(dir_path)

    print(f"\nCarpetas físicas en disco que NO tienen ningún registro asociado en la Base de Datos: {len(missing_directories)}")
    
    if missing_directories:
        print("\nPrimeras 30 carpetas desasociadas (sin registro en BD):")
        for idx, d in enumerate(missing_directories[:30]):
            # Contar archivos en la carpeta
            stdin, stdout, stderr = ssh.exec_command(f"find '{d}' -maxdepth 1 -type f -name '*.pdf' | wc -l")
            pdf_count = stdout.read().decode('utf-8').strip()
            print(f" {idx+1:2d}. Ruta: {d} ({pdf_count} PDFs)")
            
    ssh.close()

if __name__ == "__main__":
    main()
