import openpyxl
import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    # 1. Inspeccionar Plantilla_Creacion_Expedientes (11).xlsx para Viviana
    fpath = r"C:\Users\Usuario\Downloads\Plantilla_Creacion_Expedientes (11).xlsx"
    print(f"=== LEYENDO {fpath} PARA ENCONTRAR EXPEDIENTES DE VIVIANA ===")
    wb = openpyxl.load_workbook(fpath, data_only=True)
    ws = wb['Plantilla_Expedientes']
    
    viviana_rows = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        row_str = " ".join([str(c) for c in row if c is not None])
        if "viviana" in row_str.lower() or "villamizar" in row_str.lower():
            viviana_rows.append((idx, row[3], row[9], row[10], row[11]))

    print(f"Total expedientes encontrados para Viviana en Excel (11): {len(viviana_rows)}")
    for r in viviana_rows[:10]:
        print(r)

    # 2. Consultar en PostgreSQL si existen documentos cargados por Viviana o expedientes asignables a ella
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("192.168.8.164", username="cimi", password="Automatizador2026*", timeout=10)
    
    cmd = """
    PGPASSWORD='admin2026' psql -U postgres -d sena_db -h localhost -c "
    SELECT id, title, subserie, metadata_values 
    FROM expedientes 
    WHERE metadata_values ILIKE '%viviana%' OR metadata_values ILIKE '%villamizar%' OR title ILIKE '%viviana%' OR title ILIKE '%villamizar%';
    "
    """
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("\n--- EXPEDIENTES EN BASE DE DATOS PARA VIVIANA ---")
    print(stdout.read().decode('utf-8', errors='replace').strip())
    ssh.close()

if __name__ == "__main__":
    main()
