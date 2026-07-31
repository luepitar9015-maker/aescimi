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
        print(f"Conectado exitosamente a {ip}")
    except Exception as e:
        print(f"Error SSH: {e}")
        return

    # 1. Buscar bases de datos postgres
    print("\n================ BASES DE DATOS POSTGRES ================")
    cmd_dbs = "PGPASSWORD='admin2026' psql -U postgres -h localhost -l"
    stdin, stdout, stderr = ssh.exec_command(cmd_dbs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 2. Consultar documentos cargados o modificados recientemente en sena_db
    print("\n================ DOCUMENTOS EN sena_db CON STATUS != Pendiente O CON load_date ================")
    cmd_docs = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT id, expediente_id, filename, status, load_date, created_at FROM documents WHERE status != 'Pendiente' OR load_date IS NOT NULL ORDER BY id DESC LIMIT 30;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 3. Contar total de documentos en sena_db por status
    print("\n================ CONTEO DE DOCUMENTOS POR STATUS EN sena_db ================")
    cmd_status = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT status, COUNT(*) FROM documents GROUP BY status;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_status)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 4. Asignaciones de Luis Miguel (ID 19) y Jesus (ID 21)
    print("\n================ ASIGNACIONES DE LUIS MIGUEL (19) Y JESUS (21) ================")
    cmd_asig = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT u.id, u.full_name, COUNT(ea.id) FROM users u LEFT JOIN expediente_assignments ea ON ea.user_id = u.id WHERE u.id IN (19, 21) GROUP BY u.id, u.full_name;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_asig)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 5. Buscar archivos PDF recién creados o modificados en el servidor
    print("\n================ ARCHIVOS PDF CREADOS O MODIFICADOS EN LOS ÚLTIMOS 10 DÍAS ================")
    cmd_pdfs = "find /home/cimi /mnt/almacen /var /tmp -name '*.pdf' -mtime -10 2>/dev/null | head -n 30"
    stdin, stdout, stderr = ssh.exec_command(cmd_pdfs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 6. Buscar todas las tablas o esquemas en Postgres sena_db
    print("\n================ TABLAS Y REGISTROS EN sena_db ================")
    cmd_tbls = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT table_name FROM information_schema.tables WHERE table_schema='public';\""
    stdin, stdout, stderr = ssh.exec_command(cmd_tbls)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
