"""
dump_importar_controls.py - Dumps all UI control info from the Import panel
so we can identify the correct automation IDs for keyword fields.
"""
import pywinauto
import sys
import io

def log(msg):
    print(msg, flush=True)

def main():
    log("Connecting to OnBase Unity Client...")
    try:
        app = pywinauto.Application(backend="uia").connect(title_re=".*OnBase.*")
        win = app.window(title_re=".*OnBase.*")
        win.set_focus()
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)

    log("Dumping all Edit and ComboBox controls...")
    log("=" * 60)
    
    def dump_element(element, depth=0):
        indent = "  " * depth
        info = element.element_info
        title = info.name or ""
        auto_id = info.automation_id or ""
        ctrl_type = info.control_type or ""
        
        if ctrl_type in ("Edit", "ComboBox", "Button", "Text", "ListItem"):
            log(f"{indent}[{ctrl_type}] title='{title}' auto_id='{auto_id}'")
        
        try:
            for child in element.children():
                dump_element(child, depth + 1)
        except Exception:
            pass
    
    dump_element(win)
    
    log("=" * 60)
    log("Done!")

if __name__ == '__main__':
    main()
