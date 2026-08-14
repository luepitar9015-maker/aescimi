import pywinauto
import pyautogui
import time
import sys
import os
import glob
import json
import traceback
import pandas as pd

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

PROGRESS_FILE = r"C:\Users\Usuario\query_unity_progress.json"

def log(msg):
    print(f"[ONBASE-UNITY] {msg}", flush=True)

def connect_to_onbase():
    log("Conectando a OnBase Unity Client...")
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        log(f"Conectado a: {win.window_text()}")
        return win
    except Exception as e:
        log(f"Error al conectar con OnBase: {e}")
        log("Por favor, abre OnBase de nuevo.")
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
    log("Seleccionando Grupo 'COMUNICACIONES PRODUCIDAS'...")
    try:
        group_cb = win.child_window(title="Grupos de tipos de documentos", auto_id="docTypeGroupsComboBox", control_type="ComboBox")
        if group_cb.exists(timeout=2):
            group_cb.click_input()
            time.sleep(0.3)
            pyautogui.write("COMUNICACIONES PRODUCIDAS", interval=0.01)
            pyautogui.press('enter')
            time.sleep(1)
            log("Grupo seleccionado.")
    except Exception as e:
        log(f"No se pudo seleccionar el grupo: {e}")

    log("Seleccionando '01-Comunicacion Producida (PAPEL)'...")
    try:
        listbox = win.child_window(auto_id="docTypesListBox", control_type="List")
        if listbox.exists():
            listbox.click_input()
            time.sleep(0.5)
            pyautogui.write("01-Comunicacion Producida (PAPEL)", interval=0.02)
            time.sleep(2)
            log("Tipo documental seleccionado.")
            return True
        else:
            log("No se encontro la lista docTypesListBox.")
    except Exception as e:
        log(f"Error al seleccionar tipo documental: {e}")
    return False

def check_radicado(win, radicado):
    log(f"Buscando radicado: {radicado}...")
    try:
        # Verificar si la ventana de OnBase sigue existiendo
        if not win.exists():
            log("ERROR: La ventana de OnBase ya no existe. Se detiene la ejecucion.")
            raise Exception("OnBase_Closed")
            
        edit = None
        edits = win.descendants(control_type="Edit")
        
        # Buscar por automation_id
        for e in edits:
            aid = e.automation_id()
            if aid and "RadicadoProducidaCompuesto" in aid:
                edit = e
                break
                
        # Buscar por titulo
        if not edit:
            for e in edits:
                name = e.window_text() or e.element_info.name
                if name and "Compuesto" in name:
                    edit = e
                    break
                    
        # Fallback indice
        if not edit:
            visible_edits = [e for e in edits if e.is_visible() and e.rectangle().width() > 100]
            if len(visible_edits) >= 2:
                edit = visible_edits[1]
                
        if edit:
            edit.click_input()
            time.sleep(0.2)
            pyautogui.hotkey('ctrl', 'a')
            pyautogui.press('delete')
            time.sleep(0.2)
            edit.set_edit_text(radicado)
            time.sleep(0.3)
            
            # Buscar boton verde "Buscar"
            buscar_btn = win.child_window(title="Buscar", control_type="Button")
            if buscar_btn.exists():
                buscar_btn.click_input()
            else:
                pyautogui.press('enter')
                
            time.sleep(3.5) # Esperar la busqueda
            
            # Verificar si sale un popup de aviso (No se encontraron documentos)
            try:
                dialogs = pywinauto.Desktop(backend="uia").windows(title_re="OnBase|Error|Aviso|Advertencia|Información")
                for d in dialogs:
                    if d.handle != win.handle and d.is_visible():
                        dialog_text = d.window_text()
                        log(f"  -> POPUP DETECTADO: '{dialog_text}'")
                        aceptar = d.child_window(title_re="Aceptar|OK|Cerrar", control_type="Button")
                        if aceptar.exists():
                            aceptar.click_input()
                        else:
                            pyautogui.press('enter')
                        time.sleep(1)
                        log("  -> Resultado: NO APARECE")
                        return "NO APARECE"
            except Exception as ex:
                log(f"Error al verificar popup: {ex}")
            
            log("  -> Resultado: APARECE")
            return "APARECE"
            
        else:
            log("  -> Error: No se pudo encontrar el campo del radicado compuesto.")
            return "ERROR_CAMPO"
            
    except Exception as e:
        if str(e) == "OnBase_Closed":
            raise e
        log(f"  -> Excepcion en busqueda: {repr(e)}")
        log(traceback.format_exc())
        return "ERROR_EJECUCION"

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_progress(progress):
    try:
        with open(PROGRESS_FILE, "w") as f:
            json.dump(progress, f, indent=4)
    except Exception as e:
        log(f"No se pudo guardar el progreso: {e}")

def main():
    log("=== INICIANDO CONSULTA AUTOMÁTICA EN ONBASE ===")
    
    # 1. Obtener radicados locales
    pdf_dir = r"C:\Users\Usuario\Documents\UNIDAD DE CORRESPONDENCIA PENDIENTE\COMUNICACIONES PRODUCIDAS"
    pdf_paths = glob.glob(os.path.join(pdf_dir, "**", "*.pdf"), recursive=True)
    radicados = []
    for p in pdf_paths:
        name = os.path.splitext(os.path.basename(p))[0]
        if name.startswith("68-2-"):
            radicados.append(name)
            
    if not radicados:
        log("No se encontraron archivos PDF locales.")
        sys.exit(0)
        
    log(f"Total radicados locales a consultar: {len(radicados)}")
    
    # Cargar progreso anterior
    progress = load_progress()
    log(f"Radicados ya consultados en progreso previo: {len(progress)}")
    
    # 2. Conectar a OnBase
    win = connect_to_onbase()
    
    # Abrir panel de Recuperacion si no esta abierto
    click_recuperacion(win)
    
    # 3. Seleccionar Tipo Documental
    select_document_type(win)
    
    # 4. Iterar
    results = []
    try:
        for idx, rad in enumerate(radicados, 1):
            if rad in progress:
                # Saltar ya consultados
                results.append({"Radicado": rad, "Estado_OnBase": progress[rad]})
                continue
                
            log(f"[{idx}/{len(radicados)}] Procesando...")
            status = check_radicado(win, rad)
            results.append({"Radicado": rad, "Estado_OnBase": status})
            
            # Guardar progreso inmediatamente
            progress[rad] = status
            save_progress(progress)
            
            time.sleep(0.5)
            
    except Exception as e:
        if str(e) == "OnBase_Closed":
            log("Ejecucion pausada porque se cerro OnBase. Puedes volver a abrirlo y reiniciar para continuar.")
        else:
            log(f"Ejecucion interrumpida: {e}")
            
    # 5. Generar y guardar reporte
    if results:
        df = pd.DataFrame(results)
        print("\n=== RESUMEN DE LA CONSULTA (HASTA AHORA) ===")
        print(df.to_string(index=False))
        
        report_path = os.path.join(pdf_dir, "REPORTE_CONSULTA_ONBASE.xlsx")
        df.to_excel(report_path, index=False)
        log(f"\nReporte guardado en Excel: {report_path}")
        
        # Si se consultaron todos, borrar el progreso temporal
        if len(progress) >= len(radicados):
            try:
                os.remove(PROGRESS_FILE)
                log("Progreso temporal borrado (proceso completado).")
            except Exception:
                pass

if __name__ == '__main__':
    main()
