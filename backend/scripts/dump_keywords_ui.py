import pywinauto
import time
import sys
import contextlib
import pyautogui

def log(msg):
    print(f"[DUMP-KEYWORDS] {msg}", flush=True)

def main():
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        
        # Focus listbox and select type to ensure keywords are visible
        listbox = win.child_window(auto_id="docTypesListBox", control_type="List")
        if listbox.exists():
            log("Focusing listbox...")
            listbox.click_input()
            time.sleep(0.5)
            pyautogui.write("01-FRM-Comunicacion Producida", interval=0.02)
            time.sleep(2)
            
        log("Dumping UI tree to C:\\Users\\Usuario\\keywords_ui_tree.txt...")
        with open("C:\\Users\\Usuario\\keywords_ui_tree.txt", "w", encoding="utf-8") as f:
            with contextlib.redirect_stdout(f):
                win.print_control_identifiers(depth=9)
        log("Dump complete.")
        
    except Exception as e:
        log(f"Error: {e}")

if __name__ == '__main__':
    main()
