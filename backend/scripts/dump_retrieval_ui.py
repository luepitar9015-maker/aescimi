import pywinauto
import time
import sys
import contextlib

def log(msg):
    print(f"[UI-DUMP] {msg}", flush=True)

def main():
    log("Connecting to OnBase Unity Client...")
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
        time.sleep(1)
        log("Connected.")
        
        # Click Retrieval button in ribbon
        log("Clicking 'Recuperación' button in ribbon...")
        btn = win.child_window(title="Recuperación", control_type="Button")
        if btn.exists(timeout=3):
            btn.click_input()
            time.sleep(3)
            log("Clicked 'Recuperación'.")
        
        # Dump UI tree
        log("Dumping UI tree to C:\\Users\\Usuario\\retrieval_ui_tree.txt...")
        with open("C:\\Users\\Usuario\\retrieval_ui_tree.txt", "w", encoding="utf-8") as f:
            with contextlib.redirect_stdout(f):
                win.print_control_identifiers(depth=8)
        log("Dump complete.")
        
    except Exception as e:
        log(f"Error: {e}")

if __name__ == '__main__':
    main()
