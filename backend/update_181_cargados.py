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

    print("\n================ MARCANDO EXACTAMENTE 181 DOCUMENTOS DE DERECHO DE PETICIÓN COMO 'Cargado' ================")
    
    # Marcamos los primeros 181 documentos de Derecho de Peticion (01_DERECHO DE PETICION) como 'Cargado'
    cmd_update = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    WITH to_update AS (
        SELECT d.id
        FROM documents d
        JOIN expedientes e ON e.id = d.expediente_id
        WHERE (e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%')
          AND d.filename ILIKE '%01_DERECHO DE PETICION%'
        ORDER BY d.id ASC
        LIMIT 181
    )
    UPDATE documents
    SET status = 'Cargado', load_date = COALESCE(load_date, CURRENT_TIMESTAMP)
    WHERE id IN (SELECT id FROM to_update);
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_update)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ CONTEO ACTUALIZADO DE DOCUMENTOS EN DERECHOS DE PETICIÓN ================")
    cmd_count = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.status, COUNT(d.id)
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%'
    GROUP BY d.status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_count)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
