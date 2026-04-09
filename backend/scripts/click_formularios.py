import pyautogui
import pywinauto
import time
import sys
import os

def log(msg):
    print(f"[ONBASE-ROBOT] {msg}")

def main():
    try:
        log("Focusing OnBase window...")
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        unity_win = app.window(title_re=".*OnBase.*")
        unity_win.set_focus()
        time.sleep(1)
        
        # We know the button "Formularios" is under the "Inicio" tab in the "Crear" section.
        # We will try to click it via pywinauto UI automation first, as it's more reliable than screenshots
        
        log("Trying to find the 'Formularios' button in the UI tree...")
        formularios_btn = unity_win.child_window(title="Formularios", control_type="Button")
        
        if formularios_btn.exists():
            log("Clicking 'Formularios' button via UI Automation...")
            formularios_btn.click_input()
        else:
            log("Could not find 'Formularios' button in UI Tree, falling back to coordinates...")
            # Approximate coordinates based on the 1920x1080 screenshot
            # The window starts at 0,0. The 'Formularios' icon is roughly in the top middle.
            # X ~ 840, Y ~ 100
            rect = unity_win.rectangle()
            # Calculate relative position
            click_x = rect.left + 840
            click_y = rect.top + 100
            
            pyautogui.click(click_x, click_y)
            
        time.sleep(2)
        
        log("Taking screenshot of the new state: unity_forms_post.png")
        unity_win.capture_as_image().save("unity_forms_post.png")
        log("Done.")
        
    except Exception as e:
        log(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
