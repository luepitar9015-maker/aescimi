import paramiko
import sys
import io
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def deploy_files():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    # Lista de archivos locales y sus destinos remotos correspondientes
    local_backend_dir = r"d:\SENA V2\INSTALADOR_SENA\backend"
    remote_backend_dir = "/home/cimi/aescimi/backend"
    
    files_to_copy = [
        ("server.js", "server.js"),
        ("routes/auth.js", "routes/auth.js"),
        ("routes/audit.js", "routes/audit.js"),
        ("middleware/auditMiddleware.js", "middleware/auditMiddleware.js"),
        ("setup_db.js", "setup_db.js"),
        ("reset_sequences.js", "reset_sequences.js"),
        ("quitar_tilde.js", "quitar_tilde.js"),
        ("sync_storage_to_db.js", "sync_storage_to_db.js"),
        ("routes/ades.js", "routes/ades.js"),
        ("controllers/automationController.js", "controllers/automationController.js")
    ]
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado a SSH en {ip}!")
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    sftp = ssh.open_sftp()
    
    # Asegurar que existan directorios remotos (ej: middleware/ o routes/)
    remote_dirs = ["middleware", "routes"]
    for d in remote_dirs:
        try:
            sftp.mkdir(f"{remote_backend_dir}/{d}")
            print(f"Directorio remoto creado: {remote_backend_dir}/{d}")
        except IOError:
            # Ya existe
            pass
            
    # Copiar archivos
    for local_rel, remote_rel in files_to_copy:
        local_path = os.path.join(local_backend_dir, local_rel.replace('/', os.sep))
        remote_path = f"{remote_backend_dir}/{remote_rel}"
        
        if os.path.exists(local_path):
            try:
                sftp.put(local_path, remote_path)
                print(f"Copiado: {local_rel} -> {remote_rel}")
            except Exception as e:
                print(f"Error copiando {local_rel}: {e}")
        else:
            print(f"Archivo local no encontrado: {local_path}")
            
    sftp.close()
    
    # Reiniciar backend en PM2
    print("\nReiniciando servidor backend (PM2)...")
    stdin, stdout, stderr = ssh.exec_command("pm2 restart sena-backend")
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("Error de reinicio:", err)
        
    ssh.close()
    print("Despliegue finalizado.")

if __name__ == "__main__":
    deploy_files()
