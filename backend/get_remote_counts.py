import paramiko
import sys

def get_counts():
    ip = "192.168.8.164"
    ssh_user = "cimi"
    ssh_password = "Automatizador2026*"
    db_user = "postgres"
    db_name = "sena_db"
    db_password = "admin2026"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=ssh_user, password=ssh_password, timeout=10)
        print(f"Conectado exitosamente por SSH al servidor {ip}!")
    except Exception as e:
        print(f"Error al conectar por SSH a {ip}: {e}")
        return
        
    # Obtener las tablas
    list_tables_cmd = f"PGPASSWORD='{db_password}' psql -U {db_user} -d {db_name} -h localhost -t -c \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;\""
    
    stdin, stdout, stderr = ssh.exec_command(list_tables_cmd)
    tables_output = stdout.read().decode('utf-8', errors='replace').strip()
    err_output = stderr.read().decode('utf-8', errors='replace').strip()
    
    if err_output:
        print(f"Error consultando tablas en psql: {err_output}")
        ssh.close()
        return

    tables = [t.strip() for t in tables_output.split('\n') if t.strip()]
    if not tables:
        print("No se encontraron tablas públicas en la base de datos.")
        ssh.close()
        return

    print("\nConsultando conteos de registros...")
    print(f"{'Tabla':<40} | {'Registros':<12}")
    print("-" * 55)
    
    total_registros = 0
    for table in tables:
        count_cmd = f"PGPASSWORD='{db_password}' psql -U {db_user} -d {db_name} -h localhost -t -c \"SELECT COUNT(*) FROM \\\"{table}\\\";\""
        stdin, stdout, stderr = ssh.exec_command(count_cmd)
        count_val = stdout.read().decode('utf-8', errors='replace').strip()
        
        try:
            count_num = int(count_val)
            total_registros += count_num
            print(f"{table:<40} | {count_num:<12}")
        except ValueError:
            print(f"{table:<40} | Error: {count_val.strip()}")
            
    print("-" * 55)
    print(f"{'TOTAL EN EL SISTEMA':<40} | {total_registros:<12}")
    
    ssh.close()

if __name__ == "__main__":
    get_counts()
