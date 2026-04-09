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
        
        # Look for the search box
        log("Looking for 'Buscar' input box using coordinates...")
        # Based on the screenshot, the 'Buscar' field is selected but no text was typed, 
        # or it didn't filter as expected. Let's try locating 'Radicacion Producida' directly.
        
        # Approximate location of "01-FRM-Radicacion Producida" in the list vertically
        # Assuming the search didn't work and we just click it from the list directly
        # X ~ 100, Y ~ 640
        rect = unity_win.rectangle()
        form_x = rect.left + 100
        form_y = rect.top + 640
        
        log(f"Double clicking form at coordinates ({form_x}, {form_y})")
        pyautogui.doubleClick(form_x, form_y)
        time.sleep(4)
        log("Taking screenshot of form opened: unity_form_open.png")
        unity_win.capture_as_image().save("unity_form_open.png")
        log("Done.")
        
    except Exception as e:
        log(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
