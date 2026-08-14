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

    print("\n================ INFORMACIÓN DE USUARIO DE VIVIANA ================")
    cmd_u = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT id, full_name, email, role, is_active FROM users WHERE full_name ILIKE '%viviana%' OR full_name ILIKE '%villamizar%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_u)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ PERMISOS TRD DE VIVIANA ================")
    cmd_perm = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT utp.id, utp.user_id, u.full_name, ts.series_code, ts.series_name
    FROM user_trd_permissions utp
    JOIN users u ON u.id = utp.user_id
    JOIN trd_series ts ON ts.id = utp.series_id
    WHERE u.full_name ILIKE '%viviana%' OR u.full_name ILIKE '%villamizar%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_perm)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ ASIGNACIONES ACTUALES EN expediente_assignments ================")
    cmd_asig = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT ea.id, ea.expediente_id, ea.user_id, u.full_name
    FROM expediente_assignments ea
    JOIN users u ON u.id = ea.user_id
    WHERE u.full_name ILIKE '%viviana%' OR u.full_name ILIKE '%villamizar%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_asig)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ PAQUETES / LOTES EN expediente_paquetes O paquete_items ================")
    cmd_paq = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT ep.id, ep.nombre, ep.user_id, ep.created_by, u.full_name, COUNT(pi.id)
    FROM expediente_paquetes ep
    JOIN users u ON u.id = ep.user_id
    LEFT JOIN paquete_items pi ON pi.paquete_id = ep.id
    WHERE u.full_name ILIKE '%viviana%' OR u.full_name ILIKE '%villamizar%'
    GROUP BY ep.id, ep.nombre, ep.user_id, ep.created_by, u.full_name;
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_paq)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    print("\n================ DOCUMENTOS O METADATOS VINCULADOS A VIVIANA EN documents ================")
    cmd_docs = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT d.id, d.expediente_id, d.filename, d.status, d.load_date, d.metadata_values
    FROM documents d
    WHERE d.metadata_values ILIKE '%viviana%' OR d.metadata_values ILIKE '%villamizar%' OR d.filename ILIKE '%viviana%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
