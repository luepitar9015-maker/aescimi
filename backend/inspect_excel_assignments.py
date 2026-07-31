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

    print("\n================ TABLA expediente_paquetes ================")
    cmd_paq = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT * FROM expediente_paquetes;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_paq)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ MUESTRA DE paquete_items ================")
    cmd_items = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT pi.paquete_id, p.nombre, p.user_id, u.full_name, COUNT(pi.id) FROM paquete_items pi JOIN expediente_paquetes p ON p.id = pi.paquete_id JOIN users u ON u.id = p.user_id GROUP BY pi.paquete_id, p.nombre, p.user_id, u.full_name;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_items)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ DERECHOS DE PETICIÓN EN EXPEDIENTES ================")
    cmd_dp = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT subserie, COUNT(*) FROM expedientes WHERE subserie ILIKE '%peticion%' OR subserie ILIKE '%derecho%' OR title ILIKE '%peticion%' GROUP BY subserie;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_dp)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ EXPEDIENTES POR SUBSERIE ================")
    cmd_sub = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT subserie, COUNT(*) FROM expedientes GROUP BY subserie ORDER BY COUNT(*) DESC LIMIT 20;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_sub)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
