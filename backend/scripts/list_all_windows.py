import win32gui
import win32process

def winEnumHandler(hwnd, ctx):
    if win32gui.IsWindowVisible(hwnd):
        title = win32gui.GetWindowText(hwnd)
        if title:
            threadId, processId = win32process.GetWindowThreadProcessId(hwnd)
            print(f"HWND: {hwnd} | PID: {processId} | Title: {title}")

print("Listing all visible windows:")
win32gui.EnumWindows(winEnumHandler, None)
