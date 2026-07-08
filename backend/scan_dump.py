import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    dump_file = r"d:\SENA V2\INSTALADOR_SENA\base_de_datos_sena_db.sql"
    
    print("=== BUSCANDO COPY EN EL DUMP SQL ===")
    with open(dump_file, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f, 1):
            if "COPY public.trd_series" in line or "COPY public.trd_subseries" in line or "COPY public.user_trd_permissions" in line:
                print(f"Línea {idx}: {line.strip()}")

if __name__ == "__main__":
    main()
