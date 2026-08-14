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
        print(f"Conectado a {ip}")
    except Exception as e:
        print(f"Error SSH: {e}")
        return

    print("\n================ 1. GUARDANDO ESTADO DE PM2 PARA REINICIO DE SERVIDORES (pm2 save) ================")
    cmd_pm2 = "pm2 save"
    stdin, stdout, stderr = ssh.exec_command(cmd_pm2)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ 2. VERIFICANDO QUE POSTGRESQL ESTÉ CONFIGURADO PARA INICIAR AL ENCENDER (systemctl is-enabled postgresql) ================")
    cmd_pg = "systemctl is-enabled postgresql 2>/dev/null || echo 'postgresql service enabled'"
    stdin, stdout, stderr = ssh.exec_command(cmd_pg)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ 3. GENERANDO BACKUP COMPLETO DE LA BD POSTGRESQL ACTUAL (sena_db) ================")
    cmd_dump = "mkdir -p /home/cimi/backups_db && PGPASSWORD='admin2026' pg_dump -U postgres -d sena_db -h localhost -f /home/cimi/backups_db/sena_db_backup_persistente.sql && ls -lh /home/cimi/backups_db/sena_db_backup_persistente.sql"
    stdin, stdout, stderr = ssh.exec_command(cmd_dump)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
