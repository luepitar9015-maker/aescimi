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
    except Exception as e:
        print(f"Error: {e}")
        return

    # Escribir el script JS en el servidor remoto
    remote_script_path = "/home/cimi/aescimi/backend/search_db_node.js"
    script_content = """
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

const terms = ["1116182456", "3139626"];

async function run() {
    const client = await pool.connect();
    try {
        // Obtener tablas
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        
        const tables = tablesRes.rows.map(r => r.table_name);
        
        for (const term of terms) {
            console.log(`\\n===== Buscando '${term}' en todas las tablas =====`);
            let termFound = false;
            
            for (const table of tables) {
                // Obtener columnas de texto/json
                const colsRes = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                      AND data_type IN ('character varying', 'text', 'jsonb', 'json')
                `, [table]);
                
                const cols = colsRes.rows.map(r => r.column_name);
                
                for (const col of cols) {
                    try {
                        const searchRes = await client.query(`
                            SELECT COUNT(*) as count 
                            FROM "${table}" 
                            WHERE "${col}"::text ILIKE $1
                        `, [`%${term}%`]);
                        
                        const count = parseInt(searchRes.rows[0].count, 10);
                        if (count > 0) {
                            console.log(`Encontrado en Tabla: ${table}, Columna: ${col}, Coincidencias: ${count}`);
                            termFound = true;
                            
                            // Mostrar los primeros 3 registros
                            const dataRes = await client.query(`
                                SELECT * 
                                FROM "${table}" 
                                WHERE "${col}"::text ILIKE $1
                                LIMIT 3
                            `, [`%${term}%`]);
                            console.log("Muestra de datos:", JSON.stringify(dataRes.rows, null, 2));
                        }
                    } catch (e) {
                        // Ignorar errores de columnas
                    }
                }
            }
            if (!termFound) {
                console.log(`No se encontró el término '${term}' en ninguna tabla.`);
            }
        }
    } catch (err) {
        console.error("Error:", err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
"""
    
    # Crear archivo remoto
    sftp = ssh.open_sftp()
    with sftp.open(remote_script_path, 'w') as f:
        f.write(script_content)
    sftp.close()
    
    # Ejecutar script remoto en el directorio del backend para cargar dotenv
    print("Ejecutando script de búsqueda en Node.js en el servidor...")
    cmd = "cd /home/cimi/aescimi/backend && node search_db_node.js"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("Stderr node:", err)
        
    # Limpiar script
    ssh.exec_command(f"rm -f {remote_script_path}")
    ssh.close()

if __name__ == "__main__":
    main()
