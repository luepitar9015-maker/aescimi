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
        
        # Click on "Formulario electrónico" tab to see save/submit options.
        # X ~ 150, Y ~ 25
        rect = unity_win.rectangle()
        form_tab_x = rect.left + 150
        form_tab_y = rect.top + 25
        
        log(f"Clicking 'Formulario electronico' tab at ({form_tab_x}, {form_tab_y})")
        pyautogui.click(form_tab_x, form_tab_y)
        time.sleep(1)
        
        log("Taking screenshot of ribbon: unity_ribbon_form.png")
        unity_win.capture_as_image().save("unity_ribbon_form.png")
        log("Done.")
        
    except Exception as e:
        log(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
