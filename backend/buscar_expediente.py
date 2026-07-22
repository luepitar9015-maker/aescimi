import os
import re

sql_file = r"d:\SENA V2\INSTALADOR_SENA\base_de_datos_sena_db.sql"
exp_id = "2025EX-035886"

print(f"Buscando {exp_id} en {sql_file}...")

if os.path.exists(sql_file):
    with open(sql_file, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    current_table = None
    for i, line in enumerate(lines, 1):
        if "COPY " in line:
            current_table = line.strip()
            print(f"\nTabla: {current_table}")
        if exp_id in line:
            print(f"Línea {i} (en tabla: {current_table}):\n{line.strip()}")
else:
    print("Archivo no existe.")
