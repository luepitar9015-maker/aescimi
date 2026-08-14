import openpyxl
import paramiko
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

EXCEL_PATH = r"C:\Users\Usuario\Downloads\Plantilla_Creacion_Expedientes 2025 (1).xlsx"
SERVER_IP = "192.168.8.164"
SSH_USER = "cimi"
SSH_PASS = "Automatizador2026*"

def main():
    print(f"=== LEYENDO EXCEL: {EXCEL_PATH} ===")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb['Plantilla_Expedientes']
    
    excel_docs = set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not any(row):
            continue
        doc_type_num = str(row[10]).strip() if row[10] is not None else ""
        doc_clean = "".join(filter(str.isdigit, doc_type_num))
        if len(doc_clean) >= 5:
            excel_docs.add(doc_clean)

    print(f"Total documentos de identidad únicos encontrados en Excel: {len(excel_docs)}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SSH_USER, password=SSH_PASS, timeout=15)
    print(f"Conectado a {SERVER_IP}")

    # Enviar lista como JSON
    docs_json_str = json.dumps(list(excel_docs))
    
    node_script = f"""
const {{ Pool }} = require('pg');
const pool = new Pool({{
    user: 'postgres',
    host: 'localhost',
    database: 'sena_db',
    password: 'admin2026',
    port: 5432
}});

const docs = {docs_json_str};

async function main() {{
    const client = await pool.connect();
    try {{
        console.log("=== INICIANDO VALIDACIÓN Y ASIGNACIÓN DE JESÚS ALBERTO GONZÁLEZ CASTRO ===");
        
        // 1. Obtener expedientes de Historias Académicas
        const expRes = await client.query("SELECT id, title, metadata_values FROM expedientes WHERE subserie = '68.9224.4-37'");
        const matchedIds = [];
        
        const docSet = new Set(docs);
        for (const row of expRes.rows) {{
            const title = String(row.title || '');
            const meta = String(row.metadata_values || '');
            
            // Chequear coincidencia con los documentos del Excel
            for (const d of docs) {{
                if (title.includes(d) || meta.includes(d)) {{
                    matchedIds.push(row.id);
                    break;
                }}
            }}
        }}

        console.log(`Expedientes encontrados en la BD que coinciden con el Excel de Jesús: ${{matchedIds.length}}`);

        // 2. Limpiar asignaciones previas de Jesús (user_id = 21) e insertar las exactas del Excel
        await client.query("DELETE FROM expediente_assignments WHERE user_id = 21;");
        
        let count = 0;
        for (const expId of matchedIds) {{
            await client.query(
                "INSERT INTO expediente_assignments (expediente_id, user_id, assigned_by, observaciones) VALUES ($1, 21, 4, 'Asignado según Excel 2025 Jesús')",
                [expId]
            );
            count++;
        }}
        console.log(`Total expedientes asignados a Jesús en BD: ${{count}}`);

        // 3. Evaluar el estado de los documentos cargados vs pendientes de Jesús
        const statsRes = await client.query(`
            SELECT 
                ea.expediente_id,
                COUNT(d.id) as total_docs,
                COUNT(CASE WHEN d.status = 'Cargado' THEN 1 END) as cargados,
                COUNT(CASE WHEN d.status = 'Pendiente' THEN 1 END) as pendientes
            FROM expediente_assignments ea
            LEFT JOIN documents d ON d.expediente_id = ea.expediente_id
            WHERE ea.user_id = 21
            GROUP BY ea.expediente_id;
        `);

        const rows = statsRes.rows;
        const conArchivos = rows.filter(r => parseInt(r.total_docs) > 0);
        const conCargados = rows.filter(r => parseInt(r.cargados) > 0);
        const pendientes = rows.filter(r => parseInt(r.pendientes) > 0 || parseInt(r.total_docs) === 0);

        console.log("\\n================ ESTADÍSTICAS DE CARGUE DE JESÚS ALBERTO GONZÁLEZ CASTRO ================");
        console.log(`1. Total Expedientes en Excel asignados a Jesús: ${{rows.length}}`);
        console.log(`2. Expedientes que TIENEN ARCHIVOS REGISTRADOS en almacenamiento: ${{conArchivos.length}}`);
        console.log(`3. Expedientes con documentos YA CARGADOS / COMPLETADOS en AES: ${{conCargados.length}}`);
        console.log(`4. Expedientes PENDIENTES por cargar a AES: ${{pendientes.length}}`);
        console.log("==========================================================================================");

    }} catch (err) {{
        console.error("Error:", err);
    }} finally {{
        client.release();
        await pool.end();
    }}
}}

main();
"""

    stdin, stdout, stderr = ssh.exec_command("cat << 'EOF' > /home/cimi/aescimi/backend/assign_jesus_excel.js\n" + node_script + "\nEOF\ncd /home/cimi/aescimi/backend && node assign_jesus_excel.js")
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    
    print("\n--- SALIDA DEL SERVIDOR ---")
    print(out)
    if err:
        print("\n--- ERRORES / ADVERTENCIAS ---")
        print(err)

    ssh.close()

if __name__ == "__main__":
    main()
