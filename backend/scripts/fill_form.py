import pywinauto
import pyautogui
import time
import sys

def log(msg):
    print(f"[ONBASE-ROBOT] {msg}")

def main():
    try:
        log("Focusing OnBase window...")
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        unity_win = app.window(title_re=".*OnBase.*")
        unity_win.set_focus()
        time.sleep(1)
        
        # We need to click inside the 'Tipo de envío' field to start tabbing from there.
        # Based on screenshot: X ~ 450, Y ~ 430
        rect = unity_win.rectangle()
        tipo_envio_x = rect.left + 450
        tipo_envio_y = rect.top + 430
        
        log(f"Clicking inside 'Tipo de envío' at ({tipo_envio_x}, {tipo_envio_y})")
        pyautogui.click(tipo_envio_x, tipo_envio_y)
        time.sleep(1)
        
        # 1. Tipo de envío
        # Assume it's a dropdown or text box. We'll type and tab.
        val_tipo = "TIPO_PRUEBA"
        log(f"Entering 'Tipo de envío': {val_tipo}")
        pyautogui.write(val_tipo, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        # 2. No. Anexos
        val_anexos = "2"
        log(f"Entering 'No. Anexos': {val_anexos}")
        pyautogui.write(val_anexos, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        # 3. Descripción
        val_desc = "DOCUMENTOS DE PRUEBA AES AUTOMATIZACION"
        log(f"Entering 'Descripción': {val_desc}")
        pyautogui.write(val_desc, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        # 4. Dependencia
        val_dep = "DEPENDENCIA_PRUEBA"
        log(f"Entering 'Dependencia': {val_dep}")
        pyautogui.write(val_dep, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        # 5. Nombre
        val_nombre = "NOMBRE_PRUEBA"
        log(f"Entering 'Nombre': {val_nombre}")
        pyautogui.write(val_nombre, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        # 6. Funcionario
        val_func = "SISTEMA AES"
        log(f"Entering 'Funcionario': {val_func}")
        pyautogui.write(val_func, interval=0.05)
        pyautogui.press('tab')
        time.sleep(0.5)
        
        log("Form fields filled successfully.")
        
        log("Taking screenshot of filled form: unity_form_filled.png")
        unity_win.capture_as_image().save("unity_form_filled.png")
        
        log("Attempting to save using Ctrl+S...")
        pyautogui.hotkey('ctrl', 's')
        time.sleep(3)
        
        log("Taking final screenshot: unity_form_saved.png")
        unity_win.capture_as_image().save("unity_form_saved.png")
        
        log("Done.")
        
    except Exception as e:
        log(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
