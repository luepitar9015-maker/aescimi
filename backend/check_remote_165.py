import paramiko
import sys

def check_remote_165():
    ip = "192.168.8.165"
    username = "cimi"
    password = "Aut0m4t1z4d0r2026%*"
    key_path = "C:/Users/Usuario/.ssh/id_rsa_sena"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado exitosamente por SSH a {ip} via password!")
    except Exception as e:
        try:
            ssh.connect(ip, username=username, key_filename=key_path, timeout=10)
            print(f"Conectado exitosamente por SSH a {ip} via key!")
        except Exception as e_key:
            print(f"No se pudo conectar a {ip}. Error de password: {e}. Error de key: {e_key}")
            return

    # Buscar archivos .env en el servidor
    print("Buscando archivos .env en el servidor 192.168.8.165...")
    stdin, stdout, stderr = ssh.exec_command("find ~ -name '.env' 2>/dev/null")
    env_paths = stdout.read().decode('utf-8').strip().split('\n')
    env_paths = [p for p in env_paths if p]
    
    if not env_paths:
        print("No se encontraron archivos .env en el servidor.")
        ssh.close()
        return
        
    for path in env_paths:
        print(f"\nLeyendo archivo .env en: {path}")
        stdin, stdout, stderr = ssh.exec_command(f"cat '{path}'")
        content = stdout.read().decode('utf-8')
        print(content)
        
        # Extraer variables de DB del .env
        db_config = {}
        for line in content.split('\n'):
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                db_config[k.strip()] = v.strip()
                
        db_host = db_config.get('DB_HOST', 'localhost')
        db_name = db_config.get('DB_NAME', 'sena_db')
        db_user = db_config.get('DB_USER', 'postgres')
        db_pass = db_config.get('DB_PASSWORD', 'admin2026')
        db_port = db_config.get('DB_PORT', '5432')
        
        print(f"Conectándose a Postgres en {db_host}:{db_port} (Base de datos: {db_name})...")
        # Ejecutar consulta para contar expedientes
        cmd = f"PGPASSWORD='{db_pass}' psql -U {db_user} -d {db_name} -h {db_host} -p {db_port} -c 'SELECT COUNT(*) FROM expedientes;'"
        stdin_db, stdout_db, stderr_db = ssh.exec_command(cmd)
        
        out_db = stdout_db.read().decode('utf-8').strip()
        err_db = stderr_db.read().decode('utf-8').strip()
        
        if err_db:
            print("Error al consultar BD:", err_db)
        else:
            print("Resultado de la consulta:")
            print(out_db)

    ssh.close()

if __name__ == "__main__":
    check_remote_165();
