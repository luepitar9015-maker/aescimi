import pyautogui
import sys
import os

def main():
    try:
        path = "desktop.png"
        if len(sys.argv) > 1:
            path = sys.argv[1]
        print(f"Taking screenshot and saving to: {path}")
        screenshot = pyautogui.screenshot()
        screenshot.save(path)
        print("Screenshot saved successfully.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
