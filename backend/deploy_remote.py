import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOSTS = ["aescimi.web-virtual.com", "192.168.8.165", "192.168.8.164"]
USER = "cimi"
PASS = "Automatizador2026*"

def deploy():
    connected = False
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    for host in HOSTS:
        print(f"Intentando conectar por SSH a {host}...")
        try:
            ssh.connect(host, username=USER, password=PASS, timeout=8)
            print(f"✅ Conectado exitosamente a {host}")
            connected = True
            break
        except Exception as e:
            print(f"❌ Falló conexión a {host}: {e}")
            
    if not connected:
        print("CRÍTICO: No se pudo conectar a ningún servidor.")
        sys.exit(1)

    print("\n========================================================")
    print(" EJECUTANDO ACTUALIZACIÓN DESDE GITHUB EN SERVIDOR LINUX")
    print("========================================================\n")
    
    cmd = "cd ~/aescimi && bash ACTUALIZAR_DESDE_GITHUB_LINUX.sh"
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")
        
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("STDERR:", err)
        
    ssh.close()
    print("\n========================================================")
    print(" DESPLIEGUE EN SERVIDOR FINALIZADO EXISOTAMENTE")
    print("========================================================")

if __name__ == "__main__":
    deploy()
