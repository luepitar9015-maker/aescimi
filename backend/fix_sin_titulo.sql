-- =================================================================
-- SCRIPT: fix_sin_titulo.sql
-- Propósito: Corregir expedientes con título 'Sin Título' en la BD
-- 
-- CONTEXTO: Los expedientes de "DERECHO DE PETICIÓN" (subserie 68.9224-27)
-- deben usar el valor4 (número de radicado) como título, ya que la
-- jerarquía de carpetas se basa en ese campo.
--
-- Ejecutar: psql -U postgres -d sena_db -f fix_sin_titulo.sql
-- =================================================================

-- 1. VER CUÁNTOS Y CUÁLES ESTÁN AFECTADOS
SELECT 
    e.id,
    e.expediente_code,
    e.subserie,
    e.title,
    e.opening_date,
    (e.metadata_values::jsonb)->>'valor1' AS valor1,
    (e.metadata_values::jsonb)->>'valor2' AS valor2,
    (e.metadata_values::jsonb)->>'valor3' AS valor3,
    (e.metadata_values::jsonb)->>'valor4' AS valor4,
    (SELECT COUNT(*) FROM documents d WHERE d.expediente_id = e.id) AS docs_asociados
FROM expedientes e
WHERE e.title = 'Sin Título' OR e.title IS NULL OR e.title = ''
ORDER BY e.id DESC;

-- 2. CONTEO
SELECT COUNT(*) AS total_sin_titulo 
FROM expedientes 
WHERE title = 'Sin Título' OR title IS NULL OR title = '';

-- =================================================================
-- CORRECCIÓN AUTOMÁTICA: Usar valor4 (radicado) como título
-- para expedientes de Derecho de Petición (subserie 68.9224-27)
-- =================================================================
-- DESCOMENTE Y EJECUTE cuando esté seguro:

/*
UPDATE expedientes
SET title = COALESCE(
    -- Para Derechos de Petición: usar número de radicado (valor4)
    NULLIF(TRIM((metadata_values::jsonb)->>'valor4'), ''),
    -- Fallback 1: usar valor1 (nombre del peticionario)
    NULLIF(TRIM((metadata_values::jsonb)->>'valor1'), ''),
    -- Fallback 2: usar código del expediente
    NULLIF(TRIM(expediente_code), ''),
    -- Fallback final: ID como texto único
    'EXPEDIENTE_SIN_TITULO_' || id::text
)
WHERE title = 'Sin Título' OR title IS NULL OR title = '';
*/

-- =================================================================
-- ELIMINAR expedientes SIN documentos asociados (seguro)
-- =================================================================
-- DESCOMENTE SOLO SI DESEA LIMPIAR LOS QUE NO TIENEN ARCHIVOS:

/*
DELETE FROM expedientes
WHERE (title = 'Sin Título' OR title IS NULL OR title = '')
  AND id NOT IN (
      SELECT DISTINCT expediente_id 
      FROM documents 
      WHERE expediente_id IS NOT NULL
  );
*/

-- 3. VERIFICACIÓN FINAL
SELECT COUNT(*) AS restantes_sin_titulo
FROM expedientes
WHERE title = 'Sin Título' OR title IS NULL OR title = '';
