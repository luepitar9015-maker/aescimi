import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    db_password = "admin2026"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error: {e}")
        return

    # Buscar '1116182456' y '3139626' en toda la base de datos
    search_terms = ["1116182456", "3139626"]
    
    for term in search_terms:
        print(f"\n===== Buscando '{term}' en todas las tablas =====")
        
        # Este comando SQL dinámico busca en todas las tablas públicas que tengan columnas de tipo texto
        sql = f"""
        DO $$
        DECLARE
            r RECORD;
            c RECORD;
            res_count INTEGER;
        BEGIN
            FOR r IN SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LOOP
                FOR c IN SELECT column_name FROM information_schema.columns WHERE table_name=r.table_name AND data_type IN ('character varying', 'text', 'jsonb', 'json') LOOP
                    EXECUTE format('SELECT COUNT(*) FROM %I WHERE %I::text LIKE %L', r.table_name, c.column_name, '%{term}%') INTO res_count;
                    IF res_count > 0 THEN
                        RAISE NOTICE 'Encontrado en Tabla: %, Columna: %, Coincidencias: %', r.table_name, c.column_name, res_count;
                    END IF;
                END LOOP;
            END LOOP;
        END $$;
        """
        # Ejecutar via psql
        cmd = f"PGPASSWORD='{db_password}' psql -U postgres -d sena_db -h localhost -c \"{sql}\""
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Stdout:")
        print(stdout.read().decode('utf-8', errors='replace'))
        print("Stderr:")
        print(stderr.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    main()
