import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    local_script = r"d:\SENA V2\INSTALADOR_SENA\backend\scripts\backup_diario.sh"
    remote_script_dir = "/home/cimi/aescimi/backend/scripts"
    remote_script = f"{remote_script_dir}/backup_diario.sh"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
        print(f"Conectado a SSH en {ip}!")
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    # 1. Asegurar que existe el directorio de scripts
    ssh.exec_command(f"mkdir -p {remote_script_dir}")
    
    # 2. Subir el archivo de script de backup
    sftp = ssh.open_sftp()
    try:
        sftp.put(local_script, remote_script)
        print(f"Subido: backup_diario.sh -> {remote_script}")
    except Exception as e:
        print(f"Error subiendo script: {e}")
        sftp.close()
        ssh.close()
        return
    sftp.close()

    # 3. Hacerlo ejecutable
    ssh.exec_command(f"chmod +x {remote_script}")
    print("Permisos de ejecución concedidos al script de backup.")

    # 4. Probar ejecución manual
    print("\n===== Probando ejecución manual del backup en el servidor... =====")
    stdin, stdout, stderr = ssh.exec_command(f"/bin/bash {remote_script}")
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("Error en ejecución del script:", err)

    # 5. Listar el directorio de backups para confirmar que se generó
    print("\n===== Verificando archivo generado en /mnt/almacen/backups/ =====")
    stdin, stdout, stderr = ssh.exec_command("ls -lh /mnt/almacen/backups/")
    print(stdout.read().decode('utf-8', errors='replace'))

    # 6. Configurar el Cron a las 2 AM
    print("\n===== Configurando Cron Job en el servidor... =====")
    # Comando para agregar la línea de cron evitando duplicados
    cron_cmd = (
        'crontab -l 2>/dev/null | grep -v "backup_diario.sh" > /tmp/cron_temp; '
        'echo "0 2 * * * /bin/bash /home/cimi/aescimi/backend/scripts/backup_diario.sh >> /home/cimi/backup.log 2>&1" >> /tmp/cron_temp; '
        'crontab /tmp/cron_temp; '
        'rm -f /tmp/cron_temp'
    )
    ssh.exec_command(cron_cmd)
    
    # Mostrar el crontab resultante
    stdin, stdout, stderr = ssh.exec_command("crontab -l")
    print("Crontab actual:")
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    main()
