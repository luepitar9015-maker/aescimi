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

    print("\n================ DERECHOS DE PETICIÓN EN EXPEDIENTES ================")
    cmd_dp = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT id, title, subserie, created_at, opening_date 
    FROM expedientes 
    WHERE subserie = '68.9224-27' OR subserie ILIKE '%peticion%' OR subserie ILIKE '%27%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_dp)
    out_dp = stdout.read().decode('utf-8', errors='replace').strip()
    lines_dp = out_dp.split('\n')
    print(f"Total filas encontradas: {len(lines_dp) - 4}")
    print("\nPrimeras 15 filas:")
    print("\n".join(lines_dp[:15]))

    print("\n================ DOCUMENTOS EN DERECHOS DE PETICIÓN POR ESTADO ================")
    cmd_dp_docs = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.status, COUNT(d.id)
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%' OR e.subserie ILIKE '%27%'
    GROUP BY d.status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_dp_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ DOCUMENTOS EN SUBSERIE 68.9224-27 QUE TIENEN ARCHIVOS FÍSICOS ================")
    cmd_phys = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.id, d.expediente_id, e.title, d.filename, d.status, d.path
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27' OR e.subserie ILIKE '%peticion%'
    LIMIT 30;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_phys)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
