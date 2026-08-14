import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def deploy():
    hosts = ["aescimi.web-virtual.com", "192.168.8.165", "192.168.8.164"]
    username = "cimi"
    passwords = ["Automatizador2026*", "Aut0m4t1z4d0r2026%*"]
    
    connected_ssh = None
    connected_host = None

    for host in hosts:
        print(f"Probanda conexión SSH a {host}...")
        for pwd in passwords:
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                ssh.connect(host, username=username, password=pwd, timeout=8)
                print(f"Conexión exitosa a {host}!")
                connected_ssh = ssh
                connected_host = host
                break
            except Exception as e:
                print(f"  Fallo {host} con password: {e}")
        if connected_ssh:
            break

    if not connected_ssh:
        print("No se pudo conectar a ningún host listado.")
        return

    print(f"\n[ACTUALIZACIÓN] Ejecutando pull y reinicio en {connected_host}...")
    cmd = "cd ~/aescimi && git pull origin main && pm2 restart all"
    stdin, stdout, stderr = connected_ssh.exec_command(cmd)

    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')

    print("\n[SALIDA STDOUT]:")
    print(out)
    if err:
        print("\n[SALIDA STDERR]:")
        print(err)

    connected_ssh.close()
    print("\nDespliegue en el servidor completado exitosamente.")

if __name__ == "__main__":
    deploy()
