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

    print("\n================ BUSCANDO 'miguel' O 'jesus' EN METADATOS DE EXPEDIENTES ================")
    cmd_meta = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT id, title, subserie, metadata_values 
    FROM expedientes 
    WHERE metadata_values ILIKE '%miguel%' OR metadata_values ILIKE '%jesus%' OR title ILIKE '%miguel%' OR title ILIKE '%jesus%'
    LIMIT 20;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_meta)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ BUSCANDO DOCUMENTOS CARGADOS POR USUARIOS EN documents ================")
    cmd_docs_u = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.id, d.expediente_id, d.filename, d.status, d.load_date, d.metadata_values 
    FROM documents d
    WHERE d.metadata_values ILIKE '%miguel%' OR d.metadata_values ILIKE '%jesus%'
    LIMIT 20;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_docs_u)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ DERECHOS DE PETICIÓN DE LUIS ERNESTO (user_id 4) ================")
    cmd_le = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT e.id, e.title, e.subserie 
    FROM expedientes e
    JOIN expediente_assignments ea ON ea.expediente_id = e.id
    WHERE ea.user_id = 4
    LIMIT 10;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_le)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
