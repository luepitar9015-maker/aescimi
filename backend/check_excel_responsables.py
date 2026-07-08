import os
import glob
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    downloads_path = r"C:\Users\Usuario\Downloads"
    # Buscar archivos de plantilla de creación de expedientes
    pattern = os.path.join(downloads_path, "Plantilla_Creacion_Expedientes*.xlsx")
    files = glob.glob(pattern)
    
    if not files:
        print("No se encontraron plantillas de creación de expedientes en Downloads.")
        return
        
    # Ordenar por fecha de modificación (el más reciente primero)
    files.sort(key=os.path.getmtime, reverse=True)
    
    # Procesar los 3 archivos más recientes
    for filepath in files[:3]:
        print(f"\nAnalizando archivo: {os.path.basename(filepath)}")
        try:
            # Leer el excel
            df = pd.read_excel(filepath, sheet_name=0)
            
            # Buscar la columna 'Responsable' (o sinónimos)
            resp_col = None
            for col in df.columns:
                if str(col).strip().lower() in ['responsable', 'asignado a', 'asignadoa', 'responsables', 'asignado']:
                    resp_col = col
                    break
                    
            if resp_col:
                unique_responsibles = df[resp_col].dropna().unique()
                print("Valores únicos en la columna de Responsable del Excel:")
                for r in unique_responsibles:
                    print(f"  - '{r}'")
            else:
                print("No se encontró la columna 'Responsable' en este archivo.")
                print("Columnas disponibles:", list(df.columns))
        except Exception as e:
            print(f"Error al leer el archivo: {e}")

if __name__ == "__main__":
    main()
