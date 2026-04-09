import pyautogui
import time
import os

def log(msg):
    print(f"[ONBASE-RECORDER] {msg}")

def main():
    log("==========================================")
    log("EL GRABADOR COMENZARÁ EN 10 SEGUNDOS...")
    log("Ve a OnBase Unity y prepárate para hacer los clics manuales.")
    log("==========================================")
    time.sleep(10)
    
    log("¡ACCIÓN! Tienes 10 segundos para realizar el proceso...")
    
    # Take 6 screenshots over 10 seconds (one roughly every 1.5 - 2s)
    for i in range(1, 7):
        filename = f"unity_burst_{i}.png"
        pyautogui.screenshot(filename)
        log(f"[{i}/6] Captura tomada en {filename}")
        time.sleep(1.5)
        
    log("==========================================")
    log("¡LISTO! Grabación terminada. Vuelve a VS Code y avisa al asistente.")
    log("==========================================")

if __name__ == '__main__':
    main()
