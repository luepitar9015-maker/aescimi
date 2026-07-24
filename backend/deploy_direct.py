import paramiko
import sys
import io

# Asegurar codificación utf-8 al imprimir para evitar UnicodeEncodeError en Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def deploy_direct():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print(f"[DEPLOY] Conectando a {ip}...")
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print("[DEPLOY] Conectado exitosamente por SSH!")
    except Exception as e:
        print(f"[DEPLOY ERROR] Falló la conexión SSH: {e}")
        return

    commands = [
        "echo '=== 1. Deteniendo procesos y limpiando git ==='",
        "cd ~/aescimi && git stash && git clean -fd && git pull origin main",
        "echo '=== 2. Instalando dependencias del Backend ==='",
        "cd ~/aescimi/backend && npm install --omit=dev",
        "echo '=== 3. Construyendo Frontend ==='",
        "cd ~/aescimi/frontend && npm install && npm run build",
        "echo '=== 4. Copiando archivos del Frontend compilado ==='",
        f"echo '{password}' | sudo -S mkdir -p /var/www/html/assets /usr/share/nginx/html/assets /var/www/aescimi/assets",
        f"echo '{password}' | sudo -S cp -rf /home/cimi/aescimi/frontend/dist/* /var/www/html/ 2>/dev/null || true",
        f"echo '{password}' | sudo -S cp -rf /home/cimi/aescimi/frontend/dist/* /usr/share/nginx/html/ 2>/dev/null || true",
        f"echo '{password}' | sudo -S cp -rf /home/cimi/aescimi/frontend/dist/* /var/www/aescimi/ 2>/dev/null || true",
        f"echo '{password}' | sudo -S chmod -R 755 /var/www/html /usr/share/nginx/html /var/www/aescimi 2>/dev/null || true",
        "echo '=== 5. Terminando puertos y procesos zombis ==='",
        "pm2 delete sena-backend sena-presentacion 2>/dev/null || true",
        f"echo '{password}' | sudo -S fuser -k -9 3000/tcp 2>/dev/null || true",
        f"echo '{password}' | sudo -S fuser -k -9 3005/tcp 2>/dev/null || true",
        "sleep 1",
        "echo '=== 6. Iniciando PM2 ==='",
        "cd ~/aescimi && pm2 start ecosystem.config.js && pm2 save",
        "echo '=== 7. Recargando Nginx/OpenResty ==='",
        f"echo '{password}' | sudo -S systemctl reload nginx 2>/dev/null || true",
        "echo '=== 8. Estado de PM2 ==='",
        "pm2 list"
    ]
    
    full_cmd = " && ".join(commands)
    
    print("[DEPLOY] Ejecutando comandos en el servidor...")
    stdin, stdout, stderr = ssh.exec_command(full_cmd)
    
    # Leer salida en tiempo real
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end="")
        
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("\n[DEPLOY STDERR]:")
        print(err)
        
    print("[DEPLOY] Completado!")
    ssh.close()

if __name__ == "__main__":
    deploy_direct()
