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

    print("\n1. Borrando todas las asignaciones de expediente_assignments...")
    cmd_clear = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c 'TRUNCATE TABLE expediente_assignments;'"
    stdin, stdout, stderr = ssh.exec_command(cmd_clear)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n2. Asignando DERECHOS DE PETICIÓN exclusivamente a Luis Ernesto Parada Moreno (user_id 4)...")
    # Subseries de Derechos de Petición (68.9224-27 y similares)
    cmd_assign_luis = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
    SELECT id, 4, 4, 'Asignado a Luis Ernesto - Derechos de Petición'
    FROM expedientes
    WHERE subserie ILIKE '%27%' OR subserie ILIKE '%peticion%' OR subserie ILIKE '%22.10%' OR subserie ILIKE '%22.13%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_assign_luis)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n3. Asignando HISTORIAS ACADÉMICAS a Luis Miguel (user_id 19) y Jesús (user_id 21)...")
    # Subserie de Historias Académicas (68.9224.4-37)
    cmd_assign_lmi = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
    SELECT id, 19, 4, 'Asignado a Luis Miguel - Historias Académicas'
    FROM expedientes
    WHERE subserie = '68.9224.4-37';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_assign_lmi)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    cmd_assign_jes = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones)
    SELECT id, 21, 4, 'Asignado a Jesús - Historias Académicas'
    FROM expedientes
    WHERE subserie = '68.9224.4-37';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_assign_jes)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ CONTEO DE ASIGNACIONES POR USUARIO ================")
    cmd_final = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT u.id, u.full_name, u.role, COUNT(ea.id) as total_asignados
    FROM users u
    LEFT JOIN expediente_assignments ea ON ea.user_id = u.id
    GROUP BY u.id, u.full_name, u.role
    ORDER BY u.id;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_final)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
