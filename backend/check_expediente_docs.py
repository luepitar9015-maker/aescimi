import os

sql_file = r"d:\SENA V2\INSTALADOR_SENA\base_de_datos_sena_db.sql"
exp_id_str = "1843"

print("Searching for documents for expediente_id 1843 in SQL dump...")

if os.path.exists(sql_file):
    with open(sql_file, "r", encoding="utf-8", errors="ignore") as f:
        in_documents = False
        for i, line in enumerate(f, 1):
            if "COPY public.documents" in line:
                in_documents = True
                print("Encontrada sección COPY public.documents")
                continue
            if in_documents:
                if line.startswith(r"\.") or "COPY public." in line:
                    in_documents = False
                    continue
                parts = line.split('\t')
                if len(parts) >= 10 and parts[4] == exp_id_str:
                    print(f"Línea {i}: ID={parts[0]}, expediente_id={parts[4]}, filename={parts[5]}, status={parts[9]}")
