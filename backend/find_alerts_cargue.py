import os

file_path = r"d:\SENA V2\INSTALADOR_SENA\frontend\src\pages\CargueAes.jsx"
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'saveExpedienteCode' in l or 'editingCode' in l:
        print(f"Line {i+1}: {l.strip()}")
