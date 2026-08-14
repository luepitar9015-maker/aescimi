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

    print("\n================ AUDITORÍA EN SQLITE (database.sqlite en servidor) ================")
    cmd_sqlite = """
    sqlite3 /home/cimi/aescimi/backend/database.sqlite "
    SELECT status, COUNT(*) FROM documents GROUP BY status;
    " 2>/dev/null || echo "No sqlite command or file missing"
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_sqlite)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ AUDITORÍA EN AUDIT_LOGS EN POSTGRESQL ================")
    cmd_audit = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT action, status, COUNT(*) FROM audit_logs GROUP BY action, status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_audit)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ BUSCANDO REGISTROS DE CARGADOS O LOGS DE CARGUE AES ================")
    cmd_logs = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT id, expediente_id, filename, status, load_date, path
    FROM documents
    WHERE status ILIKE '%cargad%' OR load_date IS NOT NULL OR path ILIKE '%cargad%'
    LIMIT 30;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_logs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ ARCHIVOS PDF CON NOMBRES O METADATOS QUE INDICAN CARGADO ================")
    cmd_pdf_loaded = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT e.subserie, d.status, COUNT(d.id)
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27'
    GROUP BY e.subserie, d.status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_pdf_loaded)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
