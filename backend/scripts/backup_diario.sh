#!/bin/bash

# ==========================================
# SCRIPT DE COPIA DE SEGURIDAD DIARIA (SENA)
# ==========================================

# Directorio del backend de la aplicación
BACKEND_DIR="/home/cimi/aescimi/backend"
# Ruta de destino para almacenar las copias de seguridad
BACKUP_DIR="/mnt/almacen/backups"

echo "=== INICIANDO BACKUP DIARIO [$(date)] ==="

# 1. Asegurar que la carpeta de copias de seguridad existe
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Creando directorio de backups en $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
fi

# 2. Cargar variables de entorno del archivo .env
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo "Cargando configuración desde $ENV_FILE..."
    # Leer variables de entorno (ignorando comentarios y líneas vacías)
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$' | xargs)
else
    echo "⚠️ Archivo .env no encontrado en $ENV_FILE. Usando credenciales por defecto..."
fi

# Valores por defecto si no se cargaron del .env
DB_USER=${DB_USER:-"postgres"}
DB_NAME=${DB_NAME:-"sena_db"}
DB_PASSWORD=${DB_PASSWORD:-"admin2026"}
DB_PORT=${DB_PORT:-"5432"}

# Nombre del archivo de respaldo
BACKUP_FILE="$BACKUP_DIR/sena_db_$(date +%Y-%m-%d_%H%M%S).dump"

# 3. Exportar base de datos usando pg_dump
echo "Exportando base de datos $DB_NAME en puerto $DB_PORT..."
PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -h localhost -p "$DB_PORT" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Base de datos exportada con éxito a: $BACKUP_FILE"
    # Registrar el tamaño del archivo
    ls -lh "$BACKUP_FILE"
else
    echo "❌ ERROR: Falló la exportación de la base de datos."
    exit 1
fi

# 4. Limpieza: Mantener solo las copias de seguridad de los últimos 7 días
echo "Limpiando copias de seguridad de más de 7 días de antigüedad..."
find "$BACKUP_DIR" -name "sena_db_*.dump" -type f -mtime +7 -exec rm -f {} \; -print

echo "=== BACKUP FINALIZADO CON ÉXITO [$(date)] ==="
echo "--------------------------------------------------"
