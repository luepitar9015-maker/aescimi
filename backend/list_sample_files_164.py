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

    # 1. Listar los archivos en una carpeta de ejemplo
    sample_dir = "/mnt/almacen/689224/68922427/72025000410"
    print(f"===== Archivos en {sample_dir} =====")
    stdin, stdout, stderr = ssh.exec_command(f"ls -la '{sample_dir}'")
    print(stdout.read().decode('utf-8', errors='replace'))

    # 2. Listar los archivos en otra carpeta de ejemplo (CC)
    sample_dir_cc = "/mnt/almacen/689224/68922437/3139626/CC 1116182456"
    print(f"===== Archivos en {sample_dir_cc} =====")
    stdin, stdout, stderr = ssh.exec_command(f"[ -d '{sample_dir_cc}' ] && ls -la '{sample_dir_cc}' || echo 'No existe'")
    print(stdout.read().decode('utf-8', errors='replace'))

    # 3. Buscar en la base de datos si existe alguna referencia a '72025000410' o '1116182456'
    print("\n===== Buscando referencias en la Base de Datos Postgres =====")
    
    search_queries = [
        "SELECT * FROM expedientes WHERE title LIKE '%72025000410%' OR metadata_values LIKE '%72025000410%' OR subserie LIKE '%72025000410%'",
        "SELECT * FROM expedientes WHERE title LIKE '%1116182456%' OR metadata_values LIKE '%1116182456%' OR subserie LIKE '%1116182456%'"
    ]
    
    for q in search_queries:
        print(f"\nQuery: {q}")
        cmd = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -c \"{q}\""
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8', errors='replace'))

    # 4. Contar cuántos expedientes totales tienen 'Sin Título' en la base de datos
    print("\n===== Conteo de expedientes 'Sin Título' vs con título real =====")
    count_queries = [
        "SELECT COUNT(*) FROM expedientes WHERE title = 'Sin Título'",
        "SELECT COUNT(*) FROM expedientes WHERE title != 'Sin Título'",
        "SELECT COUNT(*) FROM expedientes"
    ]
    for cq in count_queries:
        print(f"Query: {cq}")
        cmd = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -t -c \"{cq}\""
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Resultado:", stdout.read().decode('utf-8').strip())

    ssh.close()

if __name__ == "__main__":
    main()
