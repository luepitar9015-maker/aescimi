import pywinauto
import pyautogui
import time
import sys

def log(msg):
    print(f"[TEST-SELECT] {msg}", flush=True)

def main():
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        
        # Click listbox
        log("Looking for docTypesListBox...")
        listbox = win.child_window(auto_id="docTypesListBox", control_type="List")
        if listbox.exists():
            log("Found listbox. Clicking to focus...")
            listbox.click_input()
            time.sleep(0.5)
            
            # Send keys
            log("Typing '01-FRM-Comunicacion Producida'...")
            pyautogui.write("01-FRM-Comunicacion Producida", interval=0.03)
            time.sleep(1.5)
            
            # Print control identifiers to check if the selection changed
            # We can capture the screenshot to check
            log("Taking screenshot: C:\\Users\\Usuario\\select_result.png")
            win.capture_as_image().save("C:\\Users\\Usuario\\select_result.png")
            log("Done.")
        else:
            log("ListBox docTypesListBox not found.")
            
    except Exception as e:
        log(f"Error: {e}")

if __name__ == '__main__':
    main()
