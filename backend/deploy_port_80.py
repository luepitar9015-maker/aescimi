import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def deploy_port_80():
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

    # Comandos para otorgar permisos de puerto 80 a node, limpiar puertos e iniciar PM2 en puerto 80
    commands = [
        "echo '=== 1. Deteniendo PM2 ==='",
        "pm2 delete sena-backend sena-presentacion 2>/dev/null || true",
        "echo '=== 2. Otorgando permisos de puertos privilegiados a Node.js ==='",
        f"echo '{password}' | sudo -S setcap 'cap_net_bind_service=+ep' $(readlink -f $(which node))",
        "echo '=== 3. Terminando puertos 80, 3000 y 3005 ==='",
        f"echo '{password}' | sudo -S fuser -k -9 80/tcp 2>/dev/null || true",
        f"echo '{password}' | sudo -S fuser -k -9 3000/tcp 2>/dev/null || true",
        f"echo '{password}' | sudo -S fuser -k -9 3005/tcp 2>/dev/null || true",
        "sleep 1",
        "echo '=== 4. Modificando ecosystem.config.js para usar PORT 80 ==='",
        "sed -i 's/PORT: 3000/PORT: 80/g' ~/aescimi/ecosystem.config.js",
        "echo '=== 5. Iniciando PM2 en puerto 80 ==='",
        "cd ~/aescimi && pm2 start ecosystem.config.js && pm2 save",
        "echo '=== 6. Estado de PM2 y sockets ==='",
        "pm2 list",
        "ss -tlpn | grep -E ':80|:3000|:3005'"
    ]
    
    full_cmd = " && ".join(commands)
    
    print("[DEPLOY] Ejecutando comandos de puerto 80 en el servidor...")
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
    deploy_port_80()
