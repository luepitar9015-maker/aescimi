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

    print("\n================ DOCUMENTOS ASOCIADOS A DERECHOS DE PETICIÓN (68.9224-27 y otros) ================")
    cmd_dp_docs = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT e.subserie, d.status, COUNT(d.id) as total_docs
    FROM expedientes e
    LEFT JOIN documents d ON d.expediente_id = e.id
    WHERE e.subserie NOT ILIKE '%4-37%'
    GROUP BY e.subserie, d.status;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_dp_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ EXPEDIENTES SIN DOCUMENTOS REGISTRADOS EN LA TABLA documents ================")
    cmd_no_docs = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT e.subserie, COUNT(e.id) as expedientes_sin_docs
    FROM expedientes e
    LEFT JOIN documents d ON d.expediente_id = e.id
    WHERE d.id IS NULL
    GROUP BY e.subserie;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_no_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ MUESTRA DE DOCUMENTOS CARGADOS EN DERECHOS DE PETICIÓN ================")
    cmd_sample_dp = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.id, d.expediente_id, e.subserie, d.filename, d.status, d.load_date
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie NOT ILIKE '%4-37%'
    LIMIT 20;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_sample_dp)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
