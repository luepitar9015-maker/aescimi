import pywinauto
import sys

def log(msg):
    print(f"[ONBASE-UNITY-INSPECT] {msg}")

def main():
    try:
        log("Looking for OnBase Unity Client window...")
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        unity_win = app.window(title_re=".*OnBase.*")
        
        log(f"Found window: {unity_win.window_text()}")
        
        # Dump the control identifiers to a file
        log("Dumping control identifiers to unity_ui_tree.txt...")
        import sys
        import io
        import contextlib
        import time
        
        # Take an initial screenshot
        log("Taking initial screenshot: unity_initial.png")
        unity_win.capture_as_image().save("unity_initial.png")
        
        # Try to ensure we are in the "Inicio" tab to see Ribbon buttons
        try:
            inicio_tab = unity_win.child_window(title="Inicio", auto_id="HomeRibbon", control_type="TabItem")
            if inicio_tab.exists():
                log("Clicking 'Inicio' tab...")
                inicio_tab.click_input()
                time.sleep(1)
        except Exception as e:
            log(f"Could not click 'Inicio' tab: {e}")
            
        # Take a second screenshot
        log("Taking post-click screenshot: unity_post.png")
        unity_win.capture_as_image().save("unity_post.png")
        
        with open("unity_ui_tree.txt", "w", encoding="utf-8") as f:
            with contextlib.redirect_stdout(f):
                unity_win.print_control_identifiers(depth=7)
        
        log("Dump complete. Check unity_ui_tree.txt")
        
    except Exception as e:
        log(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
