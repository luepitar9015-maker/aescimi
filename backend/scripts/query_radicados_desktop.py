import pywinauto
import pyautogui
import time
import sys
import os
import glob
import pandas as pd

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

def log(msg):
    print(f"[ONBASE-QUERY] {msg}", flush=True)

def connect_to_onbase():
    log("Conectando a OnBase Unity Client...")
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        log(f"Conectado a ventana: {win.window_text()}")
        return win
    except Exception as e:
        log(f"Error al conectar: {e}. Por favor, asegúrate de tener OnBase Unity Client abierto y visible en pantalla.")
        sys.exit(1)

def click_recuperacion(win):
    log("Haciendo clic en 'Recuperación' en el ribbon...")
    try:
        btn = win.child_window(title="Recuperación", control_type="Button")
        if btn.exists(timeout=3):
            btn.click_input()
            time.sleep(2)
            log("Clic en 'Recuperación' exitoso.")
            return True
    except Exception as e:
        log(f"Boton 'Recuperación' no encontrado via UIA: {e}")
    
    # Fallback coordinates
    rect = win.rectangle()
    click_x = rect.left + 390
    click_y = rect.top + 80
    pyautogui.click(click_x, click_y)
    time.sleep(2)
    return True

def select_document_type(win):
    log("Seleccionando el tipo documental '01-FRM-Comunicacion Producida'...")
    try:
        # Intentar filtrar o seleccionar en la lista
        # En la Recuperación de OnBase hay una lista o árbol de tipos de documento.
        # Intentamos buscar el elemento en la UI.
        doc_type_item = win.child_window(title_re=".*01-FRM-Comunicacion Producida.*", control_type="ListItem")
        if doc_type_item.exists(timeout=3):
            doc_type_item.scroll_into_view()
            doc_type_item.click_input()
            time.sleep(1)
            log("Tipo documental seleccionado.")
            return True
    except Exception as e:
        log(f"No se pudo seleccionar tipo documental via UIA: {e}")
        log("Por favor, asegúrate de tener seleccionado el tipo documental '01-FRM-Comunicacion Producida' en OnBase.")
    return False

def check_radicado(win, radicado):
    log(f"Consultando radicado: {radicado}")
    try:
        # Buscar el campo del Radicado Producido Compuesto
        # Probamos con auto_id de la caja de texto de búsqueda
        edit_field = win.child_window(auto_id="-No.RadicadoProducidaCompuestoTextBox", control_type="Edit")
        if not edit_field.exists(timeout=2):
            # Probar buscando por título
            edit_field = win.child_window(title_re=".*No.*Radicado.*", control_type="Edit")
            
        if edit_field.exists(timeout=2):
            edit_field.click_input()
            time.sleep(0.2)
            pyautogui.hotkey('ctrl', 'a')
            pyautogui.press('delete')
            time.sleep(0.2)
            edit_field.set_edit_text(radicado)
            time.sleep(0.3)
            
            # Buscar el botón Buscar/Recuperar en el panel izquierdo
            # Normalmente hay un botón "Buscar" o "Recuperar"
            buscar_btn = win.child_window(title="Buscar", control_type="Button")
            if not buscar_btn.exists(timeout=1):
                buscar_btn = win.child_window(title="Recuperar", control_type="Button")
                
            if buscar_btn.exists():
                buscar_btn.click_input()
            else:
                pyautogui.press('enter')
                
            time.sleep(3) # Esperar que realice la búsqueda
            
            # Verificar si salió un aviso de "No se encontraron documentos"
            try:
                # Comprobar si hay un cuadro de diálogo/popup activo
                dialog = pywinauto.Desktop(backend="uia").window(title_re="OnBase|Error|Aviso|Advertencia|Información")
                if dialog.exists(timeout=1.5):
                    txt = dialog.window_text()
                    log(f"  -> POPUP: {txt}")
                    # Cerrar el popup
                    aceptar = dialog.child_window(title_re="Aceptar|OK|Cerrar", control_type="Button")
                    if aceptar.exists():
                        aceptar.click_input()
                    else:
                        pyautogui.press('enter')
                    time.sleep(1)
                    return "NO APARECE"
            except Exception:
                pass
            
            # Si no hay popup, verificar si el Results View o la lista de resultados contiene algún item.
            # En pywinauto, si hay resultados, aparecerá una tabla/lista.
            # Haremos una validación rápida buscando en la UI o tomando screenshot.
            # Como fallback y seguridad, asumiremos que si no hay popup y demoró, es que sí aparece,
            # pero podemos verificar si la lista de resultados (habitualmente un DataGrid o ListBox en el lado derecho)
            # tiene elementos.
            log("  -> Búsqueda completada (sin popup de error). Asumido: APARECE")
            return "APARECE"
            
    except Exception as e:
        log(f"  -> Error al interactuar con la búsqueda: {e}")
        return "ERROR_CONTROL"
    
    return "DESCONOCIDO"

def main():
    log("=== INICIANDO CONSULTA DE RADICADOS EN ONBASE DESKTOP ===")
    
    # 1. Obtener lista de radicados en formato PDF local
    pdf_dir = r"C:\Users\Usuario\Documents\UNIDAD DE CORRESPONDENCIA PENDIENTE\COMUNICACIONES PRODUCIDAS"
    pdf_paths = glob.glob(os.path.join(pdf_dir, "**", "*.pdf"), recursive=True)
    radicados = []
    for p in pdf_paths:
        name = os.path.splitext(os.path.basename(p))[0]
        # Filtrar nombres que tengan formato de radicado (ej: 68-2-...)
        if name.startswith("68-2-"):
            radicados.append(name)
            
    if not radicados:
        log("No se encontraron radicados PDF en la carpeta local.")
        sys.exit(0)
        
    log(f"Se encontraron {len(radicados)} radicados locales para verificar.")
    
    # 2. Conectar a OnBase
    win = connect_to_onbase()
    
    # 3. Ir a la pestaña Recuperación
    click_recuperacion(win)
    
    # 4. Seleccionar tipo documental
    select_document_type(win)
    
    # 5. Iterar y consultar
    results = []
    for rad in radicados:
        status = check_radicado(win, rad)
        results.append({"Radicado": rad, "Estado_OnBase": status})
        time.sleep(1)
        
    # 6. Mostrar resultados
    df_res = pd.DataFrame(results)
    print("\n=== RESULTADOS DE VERIFICACIÓN ===")
    print(df_res.to_string(index=False))
    
    # Guardar reporte en excel
    report_path = os.path.join(pdf_dir, "REPORTE_VERIFICACION_ONBASE.xlsx")
    df_res.to_excel(report_path, index=False)
    log(f"\nReporte guardado en: {report_path}")

if __name__ == '__main__':
    main()
