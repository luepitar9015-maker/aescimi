import openpyxl
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def inspect():
    fpath = r"C:\Users\Usuario\Downloads\SERIES Y SUBSERIES CON RESPONSABLE.xlsx"
    wb = openpyxl.load_workbook(fpath, data_only=True)
    ws = wb.active
    
    print(f"=== CONTENIDO DE {fpath} ===")
    for idx, row in enumerate(ws.iter_rows(values_only=True), 1):
        if any(row):
            row_str = [str(c) for c in row if c is not None]
            if "viviana" in " ".join(row_str).lower() or idx <= 10:
                print(f"Fila {idx}: {row_str}")

if __name__ == "__main__":
    inspect()
