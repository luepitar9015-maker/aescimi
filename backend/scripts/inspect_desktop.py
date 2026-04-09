import pywinauto

def log(msg):
    print(msg)

def main():
    log("Listing all top level windows with titles containing 'OnBase':")
    try:
        # Use Desktop to get all top level windows
        desktop = pywinauto.Desktop(backend="uia")
        windows = desktop.windows()
        
        found = False
        for w in windows:
            title = w.window_text()
            if "OnBase" in title:
                log(f"- Found: '{title}', Class: '{w.class_name()}', Control Type: '{w.element_info.control_type}'")
                found = True
        
        if not found:
            log("No windows found with 'OnBase' in the title. Listing all visible windows:")
            for w in windows:
                title = w.window_text()
                if title and w.is_visible():
                    log(f"  * '{title}' (Class: {w.class_name()})")
                    
    except Exception as e:
        log(f"Error: {e}")

if __name__ == '__main__':
    main()
