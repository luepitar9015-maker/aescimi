import cv2
import os

video_path = r'C:\Users\Usuario\Downloads\grabacion producidas.mp4'
output_dir = r'd:\copia del sistema sena\backend\video_frames'
os.makedirs(output_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
duration = total_frames / fps if fps > 0 else 0

print(f"Video: {total_frames} frames, {fps:.1f} FPS, {duration:.1f} seconds")

# Extract 1 frame every 2 seconds
interval = max(1, int(fps * 2))
saved = 0

for i in range(0, total_frames, interval):
    cap.set(cv2.CAP_PROP_POS_FRAMES, i)
    ret, frame = cap.read()
    if ret:
        time_s = i / fps
        filename = os.path.join(output_dir, f"frame_{saved:03d}_{time_s:.1f}s.png")
        cv2.imwrite(filename, frame)
        saved += 1
        print(f"Saved: {filename}")

cap.release()
print(f"\nDone. Saved {saved} frames to {output_dir}")
