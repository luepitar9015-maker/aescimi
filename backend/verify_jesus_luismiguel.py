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

    print("\n================ LOTES DE EXCEL / PAQUETES DE LUIS MIGUEL Y JESÚS ================")
    cmd_paq = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT ep.id as paquete_id, ep.nombre, ep.user_id, u.full_name, ep.created_at, COUNT(pi.id) as total_items
    FROM expediente_paquetes ep
    JOIN users u ON u.id = ep.user_id
    LEFT JOIN paquete_items pi ON pi.paquete_id = ep.id
    WHERE ep.user_id IN (19, 21) OR u.full_name ILIKE '%miguel%' OR u.full_name ILIKE '%jesus%'
    GROUP BY ep.id, ep.nombre, ep.user_id, u.full_name, ep.created_at;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_paq)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ RECUENTO DE ASIGNACIONES POR USUARIO ================")
    cmd_asig = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT ea.user_id, u.full_name, e.subserie, COUNT(ea.id)
    FROM expediente_assignments ea
    JOIN users u ON u.id = ea.user_id
    JOIN expedientes e ON e.id = ea.expediente_id
    WHERE ea.user_id IN (19, 21)
    GROUP BY ea.user_id, u.full_name, e.subserie;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_asig)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ COMPARACIÓN DE EXPEDIENTES ASIGNADOS ENTRE 19 Y 21 ================")
    cmd_cmp = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT 
        (SELECT COUNT(*) FROM expediente_assignments WHERE user_id = 19) as total_luis_miguel,
        (SELECT COUNT(*) FROM expediente_assignments WHERE user_id = 21) as total_jesus,
        (SELECT COUNT(*) FROM expediente_assignments ea1 JOIN expediente_assignments ea2 ON ea1.expediente_id = ea2.expediente_id WHERE ea1.user_id = 19 AND ea2.user_id = 21) as coincidentes;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_cmp)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
