import paramiko
import sys
import io

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

    # 1. Obtener 10 registros de ejemplo de expedientes en Postgres
    print("\n===== MUESTRA DE 10 REGISTROS DE EXPEDIENTES EN LA BD =====")
    cmd = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -c \"SELECT id, expediente_code, title, subserie, metadata_values FROM expedientes LIMIT 10;\""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))

    # 2. Buscar archivos excel (.xlsx, .xls, .csv) en las carpetas de subida del servidor
    print("\n===== BUSCANDO ARCHIVOS DE PLANTILLAS O EXCEL CARGADOS =====")
    cmd_find_excel = "find ~ -name '*.xlsx' -o -name '*.xls' -o -name '*.csv' 2>/dev/null"
    stdin, stdout, stderr = ssh.exec_command(cmd_find_excel)
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    main()
