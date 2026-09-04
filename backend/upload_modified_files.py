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
    local_backend_dir = os.path.dirname(os.path.abspath(__file__))
    remote_backend_dir = "/home/cimi/aescimi/backend"
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado a SSH en {ip}!")
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    sftp = ssh.open_sftp()

    # Copiar carpetas enteras de backend: routes, middleware, controllers y archivos JS raíz
    subdirs_to_copy = ["routes", "middleware", "controllers"]
    for d in subdirs_to_copy:
        try:
            sftp.mkdir(f"{remote_backend_dir}/{d}")
        except IOError:
            pass

    def put_dir_flat(sftp_client, source, target):
        if not os.path.exists(source):
            return
        for item in os.listdir(source):
            s_path = os.path.join(source, item)
            t_path = f"{target}/{item}"
            if os.path.isdir(s_path):
                try:
                    sftp_client.mkdir(t_path)
                except IOError:
                    pass
                put_dir_flat(sftp_client, s_path, t_path)
            elif item.endswith('.js') or item.endswith('.json'):
                try:
                    sftp_client.put(s_path, t_path)
                    print(f"Copiado: {s_path} -> {t_path}")
                except Exception as e:
                    print(f"Error copiando {s_path}: {e}")

    for d in subdirs_to_copy:
        put_dir_flat(sftp, os.path.join(local_backend_dir, d), f"{remote_backend_dir}/{d}")

    # Copiar archivos .js raíz del backend (server.js, database_pg.js, etc.)
    for item in os.listdir(local_backend_dir):
        s_path = os.path.join(local_backend_dir, item)
        if os.path.isfile(s_path) and (item.endswith('.js') or item == 'package.json'):
            t_path = f"{remote_backend_dir}/{item}"
            try:
                sftp.put(s_path, t_path)
                print(f"Copiado raíz: {item} -> {t_path}")
            except Exception as e:
                print(f"Error copiando {item}: {e}")
            
    sftp.close()

    # Copiar todo frontend/dist recursivamente
    local_frontend_dist = os.path.abspath(os.path.join(local_backend_dir, '..', 'frontend', 'dist'))
    remote_frontend_dist = "/home/cimi/aescimi/frontend/dist"
    print("\nDesplegando frontend/dist al servidor remoto...")

    def put_dir(sftp_client, source, target):
        for item in os.listdir(source):
            s_path = os.path.join(source, item)
            t_path = f"{target}/{item}"
            if os.path.isdir(s_path):
                try:
                    sftp_client.mkdir(t_path)
                except IOError:
                    pass
                put_dir(sftp_client, s_path, t_path)
            else:
                sftp_client.put(s_path, t_path)

    sftp2 = ssh.open_sftp()
    if os.path.exists(local_frontend_dist):
        put_dir(sftp2, local_frontend_dist, remote_frontend_dist)
        print("✅ Frontend dist desplegado correctamente.")
    sftp2.close()
    
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
