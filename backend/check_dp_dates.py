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

    print("\n================ INSPECCIONANDO DERECHOS DE PETICIÓN Y SUS FECHAS / RUTAS ================")
    cmd_dp_all = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.id, d.expediente_id, e.title, e.opening_date, d.filename, d.status, d.path
    FROM documents d
    JOIN expedientes e ON e.id = d.expediente_id
    WHERE e.subserie = '68.9224-27'
    ORDER BY d.id ASC;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_dp_all)
    out_all = stdout.read().decode('utf-8', errors='replace').strip()
    lines = out_all.split('\n')
    print(f"Total registros: {len(lines) - 4}")
    print("\nPrimeras 20 filas (IDs 1-20):")
    print("\n".join(lines[:25]))

    print("\n================ EXAMINANDO AUDIT_LOGS O TABLAS DE HISTORIAL DE CARGUES ================")
    cmd_hist = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT * FROM audit_logs ORDER BY id DESC LIMIT 20;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_hist)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
