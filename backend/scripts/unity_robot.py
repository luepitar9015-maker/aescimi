"""
unity_robot.py - Automatizador de OnBase Unity Client
Flujo: Importar > COMUNICACIONES PRODUCIDAS > 01-Comunicacion Producida (PAPEL) > Examinar PDF > Llenar campos > Importar
"""

import pyautogui
import pywinauto
import time
import sys
import os

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

def log(msg):
    print(f"[UNITY-ROBOT] {msg}", flush=True)


def get_unity_window():
    log("Conectando a OnBase Unity Client...")
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        log(f"Ventana encontrada: {win.window_text()}")
        return win
    except Exception as e:
        log(f"Error al conectar con OnBase: {e}")
        sys.exit(1)


def click_importar_button(win):
    """Click the 'Importar' button in the 'Crear' section of the ribbon."""
    log("Haciendo clic en 'Importar' del ribbon...")
    try:
        # There are 2 'Importar' buttons - one in ribbon (index 0), one in form panel (index 1)
        # We pick the first one (the ribbon button)
        btns = win.children(title="Importar", control_type="Button")
        if btns:
            btns[0].click_input()
            time.sleep(2)
            log("Clic en 'Importar' (ribbon) exitoso.")
            return True
    except Exception as e:
        log(f"No se encontro boton 'Importar' via UIA: {e}")
    
    # Fallback: click by coordinates based on video frames
    rect = win.rectangle()
    click_x = rect.left + 157
    click_y = rect.top + 80
    pyautogui.click(click_x, click_y)
    time.sleep(2)
    return True


def set_dropdown(win, label, value):
    """Set a ComboBox by its label, trying both title and automation_id."""
    log(f"Configurando dropdown '{label}' = '{value}'...")
    try:
        cb = win.child_window(title=label, control_type="ComboBox")
        if cb.exists(timeout=3):
            cb.select(value)
            time.sleep(0.5)
            log(f"  -> '{label}' configurado via title.")
            return True
    except Exception:
        pass
    log(f"  -> No se pudo configurar '{label}'.")
    return False


def fill_field_by_auto_id(win, auto_id, value):
    """Fill an Edit field using its automation_id (the most reliable method)."""
    if not value:
        return False
    log(f"Llenando campo auto_id='{auto_id}' = '{value}'...")
    try:
        edit = win.child_window(auto_id=auto_id, control_type="Edit")
        if edit.exists(timeout=3):
            edit.click_input()
            time.sleep(0.2)
            edit.set_edit_text(value)
            time.sleep(0.3)
            log(f"  -> Llenado exitosamente.")
            return True
    except Exception as e:
        log(f"  -> Error: {e}")
    return False


def click_examinar(win):
    """Click the 'Examinar' button to open the file picker."""
    log("Haciendo clic en 'Examinar' para seleccionar el PDF...")
    try:
        btn = win.child_window(title="Examinar", control_type="Button")
        if btn.exists(timeout=5):
            btn.click_input()
            time.sleep(2)
            log("'Examinar' encontrado y clickeado via UIA.")
            return True
    except Exception:
        pass

    # Fallback: coordinates (approx x=30, y=70 in the Import panel)
    rect = win.rectangle()
    click_x = rect.left + 30
    click_y = rect.top + 70
    pyautogui.click(click_x, click_y)
    time.sleep(2)
    return True


def set_file_in_dialog(file_path):
    """Type the file path in the Windows Open dialog that appeared."""
    log(f"Escribiendo ruta del archivo: {file_path}")
    time.sleep(1)
    
    try:
        # Find the Windows Open dialog
        import pywinauto
        dialog = pywinauto.Desktop(backend="uia").window(title_re="Abrir|Examinar|Open")
        if dialog.exists(timeout=5):
            # Find the filename input
            file_input = dialog.child_window(control_type="Edit", found_index=0)
            file_input.set_text(file_path)
            time.sleep(0.3)
            
            # Click Abrir
            open_btn = dialog.child_window(title_re="Abrir|Open", control_type="Button")
            open_btn.click_input()
            time.sleep(2)
            log("Archivo seleccionado exitosamente.")
            return True
    except Exception as e:
        log(f"Error con dialogo: {e}. Intentando via pyautogui...")
    
    # Fallback: type in the filename text box
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.write(file_path, interval=0.02)
    time.sleep(0.3)
    pyautogui.press('enter')
    time.sleep(2)
    return True


def fill_keyword_field(win, field_label, value):
    """Click a keyword text field by title and type the value."""
    if not value:
        return
    log(f"Llenando campo '{field_label}' = '{value}'...")
    try:
        edit = win.child_window(title=field_label, control_type="Edit")
        if edit.exists(timeout=2):
            edit.click_input()
            edit.set_edit_text(value)
            time.sleep(0.3)
            log(f"  -> OK")
            return True
    except Exception:
        pass
    log(f"  -> No se pudo llenar '{field_label}'.")
    return False


def click_importar_final(win):
    """Click the final 'Importar' button at the bottom of the left panel (the form submit)."""
    log("Haciendo clic en el boton final 'Importar'...")
    try:
        # There are 2 'Importar' buttons - one in ribbon (index 0), one in form panel (index 1)
        btns = win.children(title="Importar", control_type="Button")
        if len(btns) >= 2:
            btns[1].click_input()
            time.sleep(3)
            log("'Importar' final (form) clickeado exitosamente.")
            return True
        elif len(btns) == 1:
            btns[0].click_input()
            time.sleep(3)
            return True
    except Exception as e:
        log(f"Error buscando boton 'Importar' final: {e}")
    
    # Fallback: coordinates of 'Importar' button at the bottom of the left panel
    rect = win.rectangle()
    click_x = rect.left + 85
    click_y = rect.top + 745
    pyautogui.click(click_x, click_y)
    time.sleep(3)
    return True


def run_automation(params):
    """
    Main automation entry point.
    
    params = {
        'file_path': 'C:/Users/.../documento.pdf',     # required
        'nis': '2026-01-105854',                       # optional
        'radicado_compuesto': '68-2-2026-000001',      # optional  
        'asunto': 'RESPUESTA SOLICITUD',                # optional
        'tipo_documento': '01-Comunicacion Producida (PAPEL)',  # optional
        'medio_ingreso': 'FISICO',                     # optional ('FISICO' or 'E-MAIL')
        'entrega_mano': 'NO',                          # optional ('SI' or 'NO')
    }
    """
    file_path = params.get('file_path', '')
    if not file_path or not os.path.exists(file_path):
        log(f"ERROR: Archivo no encontrado: {file_path}")
        sys.exit(1)

    win = get_unity_window()
    
    # Step 1: Click Importar on the ribbon
    click_importar_button(win)
    
    # Wait for the import panel to appear
    time.sleep(1)
    
    # Step 2: Select file
    click_examinar(win)
    set_file_in_dialog(file_path)
    
    # Step 3: Wait for file to load and give time for dropdowns to populate
    time.sleep(2)
    
    # Step 4: Set Type fields if needed (they may already be pre-set)
    tipo_doc = params.get('tipo_documento', '01-Comunicacion Producida (PAPEL)')
    set_dropdown(win, "Tipo de documento", tipo_doc)
    
    # Step 5: Fill keyword fields using discovered automation IDs
    # ORDER REQUESTED BY USER:
    # 1. No. radicado Producido Compuesto
    # 2. NIS
    # 3. Cod. Regional
    # 4. Medio de ingreso
    # 5. entrega a la mano (SI, NO)
    # 6. tipo de Documento (Skipped here, set in Step 4)
    # 7. No. de Anexos
    # 8. Descripcion de Anexos
    # 9. Tipo de Digitalizacion (TOTAL, PARCIAL)
    # 10. Asunto
    # 11. Descripcion Asunto
    # 12. Cod. Dependencia Remitente Interno
    # 13. MAIL Cc
    # 14. Destinatario Externo
    # 15. Dependencia Destinatario Externo
    # 16. Funcionario Destinatario Externo
    # 17. Direccion Destinatario Externo
    # 18. Municipio Destinatario Externo
    # 19. Depto. Destinatario Externo
    # 20. Pais Destinatario Externo
    # 21. MAIL To
    
    fill_field_by_auto_id(win, '-No.RadicadoProducidaCompuestoTextBox', params.get('radicado_compuesto', ''))
    fill_field_by_auto_id(win, '-N.I.STextBox', params.get('nis', ''))
    fill_field_by_auto_id(win, '-Cod.RegionalTextBox', params.get('cod_regional', ''))
    fill_field_by_auto_id(win, '-MediodeIngresoTextBox', params.get('medio_ingreso', ''))
    fill_field_by_auto_id(win, '-EntregaalaManoTextBox', params.get('entrega_mano', ''))
    
    fill_field_by_auto_id(win, '-No.deAnexosTextBox', params.get('num_anexos', ''))
    fill_field_by_auto_id(win, '-DescripciondeAnexosTextBox', params.get('descripcion_anexos', ''))
    fill_field_by_auto_id(win, '-TipodeDigitalizacionTextBox', params.get('tipo_digitalizacion', ''))
    fill_field_by_auto_id(win, '-AsuntoTextBox', params.get('asunto', ''))
    fill_field_by_auto_id(win, '-DescripcionAsuntoTextBox', params.get('descripcion_asunto', ''))
    
    fill_field_by_auto_id(win, '-Cod.DependenciaRemitenteInternoTextBox', params.get('cod_dependencia_remitente', ''))
    fill_field_by_auto_id(win, '-MAILCcTextBox', params.get('mail_cc', ''))
    fill_field_by_auto_id(win, '-DestinatarioExternoTextBox', params.get('destinatario_externo', ''))
    fill_field_by_auto_id(win, '-DependenciaDestinatarioExternoTextBox', params.get('dependencia_destinatario', ''))
    fill_field_by_auto_id(win, '-FuncionarioDestinatarioExternoTextBox', params.get('funcionario_destinatario', ''))
    
    fill_field_by_auto_id(win, '-DireccionDestinatarioExternoTextBox', params.get('direccion_destinatario', ''))
    fill_field_by_auto_id(win, '-MunicipioDestinatarioExternoTextBox', params.get('municipio_destinatario', ''))
    fill_field_by_auto_id(win, '-Depto.DestinatarioExternoTextBox', params.get('depto_destinatario', ''))
    fill_field_by_auto_id(win, '-PaisDestinatarioExternoTextBox', params.get('pais_destinatario', ''))
    fill_field_by_auto_id(win, '-MAILToTextBox', params.get('mail_to', ''))
    
    # Step 6: Take a screenshot before importing
    log("Tomando captura antes de importar...")
    win.capture_as_image().save("unity_before_import.png")
    
    # Step 7: Click final Importar button
    click_importar_final(win)
    
    # Step 8: Check for and dismiss any error or confirmation dialog
    time.sleep(2)
    try:
        dialog = pywinauto.Desktop(backend="uia").window(title_re="OnBase|Error|Aviso|Advertencia|Confirmación")
        if dialog.exists(timeout=3):
            dialog_text = dialog.window_text()
            log(f"Dialogo detectado: '{dialog_text}' - Buscando boton Aceptar...")
            try:
                aceptar = dialog.child_window(title_re="Aceptar|OK|Cerrar|Close", control_type="Button")
                if aceptar.exists(timeout=2):
                    aceptar.click_input()
                    time.sleep(1)
                    log("Dialogo cerrado.")
            except Exception:
                pyautogui.press('enter')
                time.sleep(1)
    except Exception:
        pass
    
    # Step 9: Check result
    log("Tomando captura del resultado...")
    win.capture_as_image().save("unity_after_import.png")
    
    log("===========================")
    log("Automatizacion completada!")
    log("===========================")


if __name__ == '__main__':
    import json
    
    # Allow params to be passed as a JSON argument or use defaults for testing
    if len(sys.argv) > 1:
        params = json.loads(sys.argv[1])
    else:
        # Test mode - using a sample PDF from Downloads
        params = {
            'file_path': r'C:\Users\Usuario\Downloads\respuesta 7-2026-094784 - NIS2026-01-105854 SC.pdf',
            'nis': '2026-01-105854',
            'radicado_compuesto': '68-2-2026-000559',
            'asunto': 'RESPUESTA SOLICITUD',
            'medio_ingreso': 'FISICO',
            'entrega_mano': 'NO',
        }
    
    run_automation(params)
