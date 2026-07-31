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

    # 1. Consultar system_settings
    print("\n================ SYSTEM_SETTINGS ================")
    cmd_settings = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT key, value FROM system_settings;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_settings)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 2. Consultar muestra de la tabla documents
    print("\n================ MUESTRA DE DOCUMENTOS EN BD ================")
    cmd_docs = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT id, expediente_id, filename, path, status, load_date FROM documents ORDER BY id DESC LIMIT 15;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_docs)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 3. Eliminar asignaciones forzadas de Leonardo Rincón (ID 2, 14, 33)
    print("\n================ ELIMINANDO ASIGNACIONES EXTRA DE LEONARDO RINCÓN ================")
    cmd_del_rincon = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"DELETE FROM expediente_assignments WHERE user_id IN (2, 14, 33);\""
    stdin, stdout, stderr = ssh.exec_command(cmd_del_rincon)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 4. Actualizar storage_path en system_settings a /mnt/almacen
    print("\n================ ACTUALIZANDO storage_path A /mnt/almacen ================")
    cmd_upd_storage = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"INSERT INTO system_settings (key, value) VALUES ('storage_path', '/mnt/almacen') ON CONFLICT (key) DO UPDATE SET value = '/mnt/almacen';\""
    stdin, stdout, stderr = ssh.exec_command(cmd_upd_storage)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 5. Re-verificar conteo de asignaciones por usuario
    print("\n================ CONTEO FINAL DE ASIGNACIONES POR USUARIO ================")
    cmd_final_asig = "PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c \"SELECT u.id, u.full_name, u.role, COUNT(ea.id) as asignaciones FROM users u LEFT JOIN expediente_assignments ea ON ea.user_id = u.id GROUP BY u.id, u.full_name, u.role HAVING COUNT(ea.id) > 0 ORDER BY u.id;\""
    stdin, stdout, stderr = ssh.exec_command(cmd_final_asig)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    ssh.close()

if __name__ == "__main__":
    main()
