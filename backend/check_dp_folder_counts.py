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
        print(f"Error SSH: {e}")
        return

    print("\n================ DESGLOSE DE DOCUMENTOS POR RUTA DE ALMACENAMIENTO ================")
    cmd_paths = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT 
        CASE 
            WHEN path LIKE '%/689224/68922427/%' THEN 'Ruta Antigua (689224/68922427)'
            WHEN path LIKE '%/9224/68922427/%' THEN 'Ruta Nueva (9224/68922427)'
            ELSE 'Otra Ruta'
        END as ubicacion,
        status,
        COUNT(*) as total
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%'
    GROUP BY ubicacion, status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_paths)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ DESGLOSE POR NOMBRE DE ARCHIVO ================")
    cmd_filenames = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT filename, status, COUNT(*)
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%'
    GROUP BY filename, status
    ORDER BY COUNT(*) DESC
    LIMIT 20;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_filenames)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
