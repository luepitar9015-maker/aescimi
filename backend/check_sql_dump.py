import paramiko
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error: {e}")
        return

    sql_path = "/home/cimi/aescimi/base_de_datos_sena_db.sql"
    print(f"===== Analizando el archivo SQL {sql_path} =====")
    
    # 1. Contar ocurrencias de INSERT INTO expedientes en el archivo SQL
    cmd = f"grep -o -i 'INSERT INTO expedientes' '{sql_path}' | wc -l"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    insert_count = stdout.read().decode('utf-8').strip()
    print(f"Ocurrencias de INSERT INTO expedientes en el archivo .sql: {insert_count}")
    
    # 2. Buscar si hay líneas que contengan inserciones de expedientes y contar los registros en el VALUE
    # Muchas veces, un solo INSERT INTO inserta múltiples registros separados por coma: (v1, v2), (v3, v4)...
    # Vamos a escribir una línea en python remoto para analizar las líneas
    remote_py = f"""
import re
count = 0
if os.path.exists('{sql_path}'):
    with open('{sql_path}', 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'INSERT INTO expedientes' in line:
                # Contar número de paréntesis de valores
                # Un patrón típico: VALUES (..., ...), (..., ...);
                # Buscamos cuántas tuplas de valores hay
                matches = re.findall(r'\\([^\\)]+\\)', line)
                count += len(matches)
    print("Registros aproximados en los INSERT de expedientes:", count)
else:
    print("Archivo no existe")
"""
    
    # Ejecutar en el servidor
    stdin, stdout, stderr = ssh.exec_command(f"python3 -c \"import os; {remote_py.strip()}\"")
    print(stdout.read().decode('utf-8', errors='replace'))
    
    ssh.close()

if __name__ == "__main__":
    main()
