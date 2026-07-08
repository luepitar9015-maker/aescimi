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
    except Exception as e:
        print(f"Error: {e}")
        return

    # Buscar palabras clave en logs
    log_files = [
        "/home/cimi/.pm2/logs/sena-backend-out-0.log",
        "/home/cimi/.pm2/logs/sena-backend-error-0.log"
    ]
    
    keywords = ["mass", "error", "fail", "guardar", "carg", "excel", "exced", "db", "pg"]
    
    for log in log_files:
        print(f"\n===== Buscando coincidencia de errores en: {log} =====")
        # Comprobar si existe
        stdin, stdout, stderr = ssh.exec_command(f"[ -f '{log}' ] && echo 'Existe' || echo 'No existe'")
        if stdout.read().decode('utf-8').strip() == 'No existe':
            print("El archivo no existe.")
            continue
            
        for kw in keywords:
            # Buscar las últimas 20 líneas coincidentes con grep (ignorar mayúsculas/minúsculas)
            cmd = f"grep -i '{kw}' '{log}' | tail -n 15"
            stdin, stdout, stderr = ssh.exec_command(cmd)
            res = stdout.read().decode('utf-8', errors='replace').strip()
            if res:
                print(f"\n--- Palabra clave: '{kw}' ---")
                print(res)

    ssh.close()

if __name__ == "__main__":
    main()
