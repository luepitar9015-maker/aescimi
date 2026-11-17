const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { pool } = require('../database_pg');
const db = require('../database');
const { requireAuth } = require('../middleware/authMiddleware');
const desercionesBotController = require('../controllers/desercionesBotController');
const desercionesEmailSyncController = require('../controllers/desercionesEmailSyncController');

// Middleware de acceso al Módulo y Robot de Deserciones: Admin, Superadmin o funcionario activo autorizado
const requireDesercionesAccess = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado.' });
    }
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        return next();
    }
    try {
        const uRes = await pool.query('SELECT id, role, is_active FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
        const u = uRes.rows && uRes.rows[0];
        if (!u || u.is_active === 0 || u.is_active === false || u.is_active === '0') {
            return res.status(403).json({ error: 'Acceso denegado. Cuenta inactiva o no encontrada.' });
        }
        if (u.role === 'admin' || u.role === 'superadmin') {
            return next();
        }
        const pRes = await pool.query(
            "SELECT can_view FROM role_permissions WHERE role_name = $1 AND module_id = 'deserciones' LIMIT 1",
            [u.role]
        );
        if (pRes.rows && pRes.rows[0] && (Number(pRes.rows[0].can_view) === 0 || pRes.rows[0].can_view === false)) {
            return res.status(403).json({ error: 'Acceso denegado. Su rol no tiene habilitado el Módulo de Deserciones.' });
        }
        return next();
    } catch (e) {
        console.error('[DESERCIONES AUTH] Error verificando permisos:', e.message);
    }
    return res.status(403).json({ error: 'Acceso denegado. No cuenta con permiso para el Módulo de Deserciones.' });
};

// Directorio persistente para Excel y Anexos de Deserciones (usa /mnt/almacen en Linux si existe)
function resolveDesercionesUploadDir() {
    if (process.platform === 'linux') {
        try {
            if (fs.existsSync('/mnt/almacen')) {
                const dir = '/mnt/almacen/deserciones_uploads';
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                return dir;
            }
        } catch (_) {}
    }
    const localDir = path.join(__dirname, '..', 'uploads', 'deserciones');
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    return localDir;
}

function listCandidateDesercionesDirs() {
    const dirs = [resolveDesercionesUploadDir(), path.join(__dirname, '..', 'uploads', 'deserciones')];
    return [...new Set(dirs)].filter(d => {
        try { return fs.existsSync(d); } catch { return false; }
    });
}

// Configuración de almacenamiento para multer (Excel y Anexos PDF/Docs)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, resolveDesercionesUploadDir());
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
});

// Helper: asegurar que la tabla deserciones_casos exista
const ensureDesercionesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deserciones_casos (
                id SERIAL PRIMARY KEY,
                etapa VARCHAR(50) NOT NULL,
                ficha VARCHAR(50),
                programa TEXT,
                aprendiz_nombre TEXT,
                aprendiz_doc_tipo VARCHAR(20),
                aprendiz_doc_numero VARCHAR(50),
                aprendiz_correo TEXT,
                causal_desercion TEXT,
                fecha_comite VARCHAR(50),
                hora_comite VARCHAR(50),
                lugar_comite TEXT,
                texto_inicial TEXT,
                texto_combinado TEXT,
                asunto TEXT,
                descripcion_asunto TEXT,
                comunicacion_pdf_path TEXT,
                anexo_path TEXT,
                onbase_target_user TEXT,
                copy_emails TEXT,
                nis VARCHAR(100),
                radicado VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS asunto TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS descripcion_asunto TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS resolucion VARCHAR(100);`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS error_message TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS error_screenshot TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS enviado_at TIMESTAMP;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS historia_doc_id INTEGER;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS fecha_radicado TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS lote_id TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS archivo_excel TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS archivo_excel_path TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS raw_row JSONB;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS excel_columns JSONB;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS excel_row_index INTEGER;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS acudiente_nombre TEXT;`);
        await pool.query(`ALTER TABLE deserciones_casos ADD COLUMN IF NOT EXISTS acudiente_correo TEXT;`);

        // Auto-reparar registros históricos donde descripcion_asunto quedó con {{RESOLUCION}} pero texto_combinado tenía la línea Asunto: ya combinada
        await pool.query(`
            UPDATE deserciones_casos
            SET descripcion_asunto = TRIM(SUBSTRING(texto_combinado FROM '(?im)^\s*Asunto:\s*([^\r\n]+)$'))
            WHERE descripcion_asunto LIKE '%{{%'
              AND SUBSTRING(texto_combinado FROM '(?im)^\s*Asunto:\s*([^\r\n]+)$') IS NOT NULL
              AND SUBSTRING(texto_combinado FROM '(?im)^\s*Asunto:\s*([^\r\n]+)$') NOT LIKE '%{{%'
        `).catch(() => {});

        // Migrar errores antiguos que hubieran quedado escritos dentro de descripcion_asunto
        await pool.query(`
            UPDATE deserciones_casos
            SET error_message = descripcion_asunto,
                descripcion_asunto = 'Notificación'
            WHERE status = 'Error'
              AND error_message IS NULL
              AND descripcion_asunto LIKE 'Error:%'
        `).catch(() => {});

        // Auto-poblar aprendiz_doc_numero desde raw_row->>'NIP' o 'DOCUMENTO' cuando haya quedado vacío
        await pool.query(`
            UPDATE deserciones_casos
            SET aprendiz_doc_numero = COALESCE(
                NULLIF(TRIM(raw_row->>'NIP'), ''),
                NULLIF(TRIM(raw_row->>'nip'), ''),
                NULLIF(TRIM(raw_row->>'DOCUMENTO'), ''),
                NULLIF(TRIM(raw_row->>'NUM_DOCUMENTO'), ''),
                NULLIF(TRIM(raw_row->>'IDENTIFICACION'), ''),
                NULLIF(TRIM(raw_row->>'CEDULA'), '')
            )
            WHERE (aprendiz_doc_numero IS NULL OR TRIM(aprendiz_doc_numero) = '')
              AND raw_row IS NOT NULL
        `).catch(() => {});

        // Retro-vincular automáticamente registros actuales con su lote de Excel original (ej. 45 aprendices.xlsx)
        try {
            const unlinkedRes = await pool.query(`
                SELECT id, etapa, ficha, aprendiz_doc_tipo, aprendiz_doc_numero, aprendiz_nombre, aprendiz_correo, programa, causal_desercion, resolucion
                FROM deserciones_casos
                WHERE lote_id IS NULL OR raw_row IS NULL
                ORDER BY id ASC
            `);
            if (unlinkedRes.rows && unlinkedRes.rows.length > 0) {
                const upDir = path.join(__dirname, '..', 'uploads', 'deserciones');
                let latestExcelPath = null;
                let parsedLatest = null;
                if (fs.existsSync(upDir)) {
                    const excelFiles = fs.readdirSync(upDir)
                        .filter(f => /\.(xlsx|xls)$/i.test(f))
                        .map(f => ({ name: f, fullPath: path.join(upDir, f), mtime: fs.statSync(path.join(upDir, f)).mtimeMs }))
                        .sort((a, b) => b.mtime - a.mtime);
                    if (excelFiles.length > 0) {
                        latestExcelPath = excelFiles[0].fullPath;
                        try {
                            parsedLatest = parseExcelWorkbookToRows(latestExcelPath, '45 aprendices.xlsx');
                        } catch (_) {}
                    }
                }

                const byDocMap = new Map();
                if (parsedLatest && Array.isArray(parsedLatest.rows)) {
                    parsedLatest.rows.forEach((r, idx) => {
                        const d = String(r.aprendiz_doc_numero || '').trim();
                        if (d) byDocMap.set(d, { ...r, rowIndex: idx + 1 });
                    });
                }

                for (const c of unlinkedRes.rows) {
                    const docNum = String(c.aprendiz_doc_numero || '').trim();
                    const matchedEx = byDocMap.get(docNum);
                    if (c.etapa === 'CITACION_COMITE' && matchedEx && parsedLatest) {
                        await pool.query(`
                            UPDATE deserciones_casos
                            SET lote_id = 'LOTE-CITACION-45-APRENDICES',
                                archivo_excel = '45 aprendices.xlsx',
                                archivo_excel_path = $2,
                                raw_row = $3::jsonb,
                                excel_columns = $4::jsonb,
                                excel_row_index = $5
                            WHERE id = $1
                        `, [
                            c.id,
                            latestExcelPath,
                            JSON.stringify(matchedEx.raw_row || {}),
                            JSON.stringify(parsedLatest.columns || []),
                            matchedEx.rowIndex || c.id
                        ]).catch(() => {});
                    } else {
                        const fallbackLote = c.etapa === 'CITACION_COMITE'
                            ? 'LOTE-CITACION-HISTORICO'
                            : 'LOTE-RESOLUCION-HISTORICO';
                        const fallbackArchivo = c.etapa === 'CITACION_COMITE'
                            ? 'Citaciones_Comite.xlsx'
                            : 'Notificaciones_Resoluciones.xlsx';
                        const fallbackCols = ['No.', 'TIPO', 'DOCUMENTO', 'NOMBRE', 'CORREO REGISTRADO EN SOFÍA', 'FICHA', 'PROGRAMA', 'RESOLUCION'];
                        const fallbackRaw = {
                            'No.': c.id,
                            'TIPO': c.aprendiz_doc_tipo || 'CC',
                            'DOCUMENTO': c.aprendiz_doc_numero || '',
                            'NOMBRE': c.aprendiz_nombre || '',
                            'CORREO REGISTRADO EN SOFÍA': c.aprendiz_correo || '',
                            'FICHA': c.ficha || '',
                            'PROGRAMA': c.programa || '',
                            'RESOLUCION': c.resolucion || ''
                        };
                        await pool.query(`
                            UPDATE deserciones_casos
                            SET lote_id = COALESCE(lote_id, $2),
                                archivo_excel = COALESCE(archivo_excel, $3),
                                raw_row = COALESCE(raw_row, $4::jsonb),
                                excel_columns = COALESCE(excel_columns, $5::jsonb),
                                excel_row_index = COALESCE(excel_row_index, $1)
                            WHERE id = $1
                        `, [
                            c.id,
                            fallbackLote,
                            fallbackArchivo,
                            JSON.stringify(fallbackRaw),
                            JSON.stringify(fallbackCols)
                        ]).catch(() => {});
                    }
                }
            }
        } catch (backfillErr) {
            console.warn('[DESERCIONES] Advertencia en retro-vinculación de lotes Excel:', backfillErr.message);
        }
    } catch (e) {
        console.error('[DESERCIONES] Error asegurando tabla deserciones_casos:', e.message);
    }
};

ensureDesercionesTable();

router.use(requireAuth, requireDesercionesAccess);

const DEFAULT_CIMI_CC_EMAILS = [
    { name: 'Manuel Valencia', email: 'mevalencia@sena.edu.co' },
    { name: 'Monica Gomez', email: 'mlgomez@sena.edu.co' },
    { name: 'Luis Ernesto Parada Moreno', email: 'leparadam@sena.edu.co' }
];

const DEFAULT_DESERCIONES_TEMPLATES = {
    asunto_citacion: 'NOVEDADES DE ALUMNOS',
    descripcion_asunto_citacion_mayor: 'Citación a Comité de Evaluación y Seguimiento – Presunta deserción por inasistencias – Ficha {{FICHA}}',
    descripcion_asunto_citacion_ti: 'Citación a Comité de Evaluación y Seguimiento (Menor de Edad TI) – Presunta deserción – Ficha {{FICHA}}',
    citacion_mayor: `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Citación a Comité de Evaluación y Seguimiento – Presunta deserción por inasistencias

Cordial saludo.

De conformidad con lo dispuesto en los artículos 50, 51 y 52 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, y en el marco de las competencias del Comité de Evaluación y Seguimiento previstas en el artículo 48 ibídem, modificado por el Acuerdo 002 de 2025, me permito informarle que esta Coordinación Académica recibió un reporte relacionado con su proceso de formación, cuyos hechos podrían configurar una situación de deserción.

En consecuencia, y con el propósito de garantizar sus derechos al debido proceso, defensa y contradicción, se le cita a sesión del Comité de Evaluación y Seguimiento, instancia encargada de revisar las circunstancias del caso y determinar, con fundamento en las pruebas y los descargos que se presenten, si se configura o no la situación de deserción reportada.

RELACIÓN SUCINTA DEL INFORME O DE LA QUEJA PRESENTADA

De acuerdo con el informe presentado por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, se reporta una situación relacionada con la Deserción POR INASISTENCIAS, que podría configurar una de las causales de deserción previstas en el artículo 30 del Acuerdo 009 de 2024. Los hechos, fechas, actuaciones y demás circunstancias que sustentan el reporte se encuentran detallados en el informe y los soportes presentados por el(la) Instructor(a) {{INSTRUCTOR}}, fechas de inasistencias reportadas: {{FECHAS_INASISTENCIA}}.

IDENTIFICACIÓN DEL(LOS) PROBABLE(S) AUTOR(ES) DE LOS HECHOS

Aprendiz: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}}
Nivel y Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}
Estado en SOFIA Plus: {{ESTADO}}

NORMAS DEL REGLAMENTO DEL APRENDIZ SENA PRESUNTAMENTE INFRINGIDAS

Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025): Artículo 30 (Causales de Deserción) y deberes académicos del aprendiz previstos en el Capítulo III.

CITACIÓN Y DERECHO DE DEFENSA Y CONTRADICCIÓN

Para ejercer su derecho a la defensa, controvertir las pruebas y presentar los descargos o soportes de justificación correspondientes, se le cita a sesión del Comité de Evaluación y Seguimiento programada así:

Fecha: {{FECHA_COMITE}}
Hora: {{HORA_COMITE}}
Lugar / Canal de Atención: {{LUGAR_COMITE}}

Contra el presente acto de trámite no procede recurso alguno, de conformidad con el artículo 75 de la Ley 1437 de 2011.

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`,

    citacion_menor_ti: `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Citación a Comité de Evaluación y Seguimiento (Aprendiz Menor de Edad - TI) – Presunta deserción por inasistencias

Cordial saludo.

De conformidad con lo dispuesto en los artículos 50, 51 y 52 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, en el marco de las competencias del Comité de Evaluación y Seguimiento previstas en el artículo 48 ibídem (modificado por el Acuerdo 002 de 2025), y en observancia de la protección reforzada del debido proceso para adolescentes y menores de edad prevista en la Ley 1098 de 2006 (Código de la Infancia y la Adolescencia), me permito informarles que esta Coordinación Académica recibió un reporte relacionado con el proceso de formación del(la) aprendiz identificado(a) con Tarjeta de Identidad ({{TIPO}} No. {{DOCUMENTO}}), cuyos hechos podrían configurar una situación de deserción.

En consecuencia, y con el propósito de garantizar de manera integral sus derechos al debido proceso, defensa y contradicción, se cita al(la) aprendiz junto con su Representante Legal, Padre de Familia o Acudiente a sesión del Comité de Evaluación y Seguimiento, instancia encargada de revisar las circunstancias del caso y determinar, con fundamento en las pruebas y los descargos que se presenten, si se configura o no la situación de deserción reportada.

RELACIÓN SUCINTA DEL INFORME O DE LA QUEJA PRESENTADA

De acuerdo con el informe presentado por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, se reporta una situación relacionada con la Deserción POR INASISTENCIAS, que podría configurar una de las causales de deserción previstas en el artículo 30 del Acuerdo 009 de 2024. Los hechos, fechas, actuaciones y demás circunstancias que sustentan el reporte se encuentran detallados en el informe y los soportes presentados por el(la) Instructor(a) {{INSTRUCTOR}}, fechas de inasistencias reportadas: {{FECHAS_INASISTENCIA}}.

IDENTIFICACIÓN DEL(LOS) PROBABLE(S) AUTOR(ES) DE LOS HECHOS

Aprendiz Menor de Edad: {{NOMBRE}} {{APELLIDOS}}
Documento de Identidad: {{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Nivel y Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}
Estado en SOFIA Plus: {{ESTADO}}

NORMAS DEL REGLAMENTO DEL APRENDIZ SENA PRESUNTAMENTE INFRINGIDAS

Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025): Artículo 30 (Causales de Deserción) y deberes académicos del aprendiz previstos en el Capítulo III.

CITACIÓN CON ACOMPAÑAMIENTO DE REPRESENTANTE LEGAL / ACUDIENTE

Por tratarse de un(a) aprendiz menor de edad con Tarjeta de Identidad ({{TIPO}}), deberá comparecer acompañado(a) de su Representante Legal, Padre de Familia o Acudiente para presentar sus descargos y soportes de justificación en la sesión del Comité de Evaluación y Seguimiento programada así:

Fecha: {{FECHA_COMITE}}
Hora: {{HORA_COMITE}}
Lugar / Canal de Atención: {{LUGAR_COMITE}}

Contra el presente acto de trámite no procede recurso alguno, de conformidad con el artículo 75 de la Ley 1437 de 2011.

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`,

    asunto_resolucion: 'NOVEDADES DE ALUMNOS',
    descripcion_asunto_resolucion_mayor: 'Notificación personal electrónica – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}',
    descripcion_asunto_resolucion_ti: 'Notificación personal electrónica (Menor de Edad TI) – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}',
    resolucion_mayor: `68-9224


Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{PROGRAMA}}
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación personal electrónica – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}

Cordial saludo.

De conformidad con lo dispuesto en el artículo 51 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA y el artículo 56 de la Ley 1437 de 2011, y teniendo en cuenta la autorización expresa otorgada por usted mediante la suscripción del formato GFPI-F-015 “Mi compromiso como Aprendiz SENA”, para recibir a través del correo electrónico registrado en SOFIA Plus las notificaciones de los actos académicos y administrativos que profiera la Entidad, por medio de la presente comunicación se efectúa la notificación personal electrónica de la Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}, expedida por la Subdirección del Centro Industrial de Mantenimiento Integral, mediante la cual se declara la deserción y se ordena la cancelación de su matrícula en el programa de formación {{PROGRAMA}}, ficha {{FICHA}}.

Para su conocimiento, se transcribe la parte resolutiva del citado acto administrativo:

“RESUELVE:

Artículo 1º. DECLARAR LA DESERCION en el proceso de formación del aprendiz mencionado.

Artículo 2º. ORDENAR LA CANCELACION DEL REGISTRO DE MATRICULA al aprendiz referido en el Artículo 1 de la Resolución, quien no podrá participar en procesos de ingreso a la institución en programas de formación titulada dentro de los seis (06) meses siguientes contados a partir del momento en que el acto administrativo suscrito por el Subdirector quede en firme, ni a programas de formación complementaria hasta por tres (03) meses siguientes, contados a partir del registro de la novedad en el Sistema de Gestión Académica, artículo 47 Acuerdo 009 de 2024.”

Para efectos de la presente notificación, se adjunta copia íntegra, auténtica y gratuita del citado acto administrativo.

Recursos: Contra la referida resolución procede el recurso de reposición ante la Subdirección del Centro Industrial de Mantenimiento Integral y, en subsidio, el recurso de apelación ante la Dirección Regional Santander, los cuales deberán interponerse por escrito dentro de los diez (10) días siguientes a la notificación, de conformidad con el artículo 51 del Acuerdo 009 de 2024 y los artículos 74 y siguientes de la Ley 1437 de 2011.

El recurso podrá presentarse mediante comunicación radicada dirigida a la Subdirección del Centro Industrial de Mantenimiento Integral, a través del correo electrónico deserciones9224@sena.edu.co o por los demás canales institucionales habilitados para la radicación de comunicaciones.

De conformidad con el artículo 56 de la Ley 1437 de 2011, la presente notificación se entenderá surtida a partir de la fecha y hora en que usted acceda a la notificación del acto administrativo, circunstancia que deberá quedar certificada por la Administración e incorporada al respectivo expediente.

Atentamente,



TATIANA ANDREA VILLAMIZAR JAIMES
Subdirectora (E)
Centro Industrial de Mantenimiento Integral



Vo. Bo. Manuel Enrique Valencia Moreno, Coordinador Académico
Elaboró. Mónica Gómez Rey, Contratista Coordinación Académica`,

    resolucion_menor_ti: `68-9224


Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{PROGRAMA}}
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación personal electrónica (Menor de Edad - TI) – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}

Cordial saludo.

De conformidad con lo dispuesto en el artículo 51 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, el artículo 56 de la Ley 1437 de 2011 y la Ley 1098 de 2006, y teniendo en cuenta la autorización expresa otorgada mediante la suscripción del formato GFPI-F-015 “Mi compromiso como Aprendiz SENA”, por medio de la presente comunicación se efectúa la notificación personal electrónica al(la) aprendiz identificado(a) con Tarjeta de Identidad ({{TIPO}} No. {{DOCUMENTO}}) y a su Representante Legal / Acudiente, respecto de la Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}, expedida por la Subdirección del Centro Industrial de Mantenimiento Integral, mediante la cual se declara la deserción y se ordena la cancelación de su matrícula en el programa de formación {{PROGRAMA}}, ficha {{FICHA}}.

Para su conocimiento, se transcribe la parte resolutiva del citado acto administrativo:

“RESUELVE:

Artículo 1º. DECLARAR LA DESERCION en el proceso de formación del aprendiz mencionado.

Artículo 2º. ORDENAR LA CANCELACION DEL REGISTRO DE MATRICULA al aprendiz referido en el Artículo 1 de la Resolución, quien no podrá participar en procesos de ingreso a la institución en programas de formación titulada dentro de los seis (06) meses siguientes contados a partir del momento en que el acto administrativo suscrito por el Subdirector quede en firme, ni a programas de formación complementaria hasta por tres (03) meses siguientes, contados a partir del registro de la novedad en el Sistema de Gestión Académica, artículo 47 Acuerdo 009 de 2024.”

Para efectos de la presente notificación, se adjunta copia íntegra, auténtica y gratuita del citado acto administrativo.

Recursos: Contra la referida resolución procede el recurso de reposición ante la Subdirección del Centro Industrial de Mantenimiento Integral y, en subsidio, el recurso de apelación ante la Dirección Regional Santander, los cuales podrán ser interpuestos por el(la) aprendiz y/o su Representante Legal o Acudiente dentro de los diez (10) días siguientes a la notificación, a través del correo electrónico deserciones9224@sena.edu.co o por los canales institucionales habilitados.

Atentamente,



TATIANA ANDREA VILLAMIZAR JAIMES
Subdirectora (E)
Centro Industrial de Mantenimiento Integral



Vo. Bo. Manuel Enrique Valencia Moreno, Coordinador Académico
Elaboró. Mónica Gómez Rey, Contratista Coordinación Académica`,

    asunto_notificacion_aprendiz: 'NOVEDADES DE ALUMNOS',
    descripcion_asunto_notificacion_aprendiz_mayor: 'Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}',
    descripcion_asunto_notificacion_aprendiz_ti: 'Notificación al Aprendiz (Menor de Edad TI) – Proceso de Deserción – Ficha {{FICHA}}',
    notificacion_aprendiz_mayor: `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}

Cordial saludo.

De conformidad con lo dispuesto en el Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025), me permito notificarle la novedad académica reportada en su proceso de formación por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, relacionada con las fechas de inasistencia: {{FECHAS_INASISTENCIA}}.

Aprendiz: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}}
Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`,

    notificacion_aprendiz_menor_ti: `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente: {{NOMBRE_ACUDIENTE}}
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación al Aprendiz (Menor de Edad - TI) – Proceso de Deserción – Ficha {{FICHA}}

Cordial saludo.

De conformidad con lo dispuesto en el Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025) y la Ley 1098 de 2006 (Código de la Infancia y la Adolescencia), me permito notificarles la novedad académica reportada en el proceso de formación por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, relacionada con las fechas de inasistencia: {{FECHAS_INASISTENCIA}}.

Aprendiz Menor de Edad: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`,

    comite_defaults: {
        fecha_comite: 'Dentro de los cinco (5) días hábiles siguientes al envío de la presente citación',
        hora_comite: '8:00 a.m. a 12:00 m. / 2:00 p.m. a 4:00 p.m.',
        lugar_comite: 'Coordinación Académica - Edificio D, Centro Industrial de Mantenimiento Integral CIMI (Km 7 vía Palenque - Rincón de Girón) o al correo deserciones9224@sena.edu.co',
        causal_desercion: 'POR INASISTENCIAS'
    }
};

// 0. Gestor de Correos en Copia (CC) Configurados Persistentes en Base de Datos
router.get('/cc-emails', requireAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_cc_emails'");
        if (result.rows && result.rows.length > 0 && result.rows[0].value) {
            try {
                const emails = JSON.parse(result.rows[0].value);
                if (Array.isArray(emails) && emails.length > 0) {
                    return res.json({ cc_emails: emails });
                }
            } catch (pErr) {
                console.warn('[DESERCIONES] Error parseando JSON de cc_emails:', pErr);
            }
        }
        // Si estaba vacío en BD, inicializar con los correos oficiales de Deserciones CIMI
        await pool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('sena_deserciones_cc_emails', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify(DEFAULT_CIMI_CC_EMAILS)]).catch(() => {});
        res.json({ cc_emails: DEFAULT_CIMI_CC_EMAILS });
    } catch (err) {
        console.error('[DESERCIONES] Error obteniendo correos CC:', err);
        res.status(500).json({ error: 'Error al consultar correos CC.' });
    }
});

// 0.1 Gestor de Plantillas Oficiales Persistentes en Base de Datos (Mayor de Edad CC vs Menor de Edad TI)
router.get('/templates', requireAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_templates_v2'");
        if (result.rows && result.rows.length > 0 && result.rows[0].value) {
            try {
                const saved = JSON.parse(result.rows[0].value);
                return res.json({
                    templates: {
                        ...DEFAULT_DESERCIONES_TEMPLATES,
                        ...saved,
                        comite_defaults: {
                            ...DEFAULT_DESERCIONES_TEMPLATES.comite_defaults,
                            ...(saved.comite_defaults || {})
                        }
                    },
                    defaults: DEFAULT_DESERCIONES_TEMPLATES
                });
            } catch (e) {}
        }
        await pool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('sena_deserciones_templates_v2', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify(DEFAULT_DESERCIONES_TEMPLATES)]).catch(() => {});
        return res.json({ templates: DEFAULT_DESERCIONES_TEMPLATES, defaults: DEFAULT_DESERCIONES_TEMPLATES });
    } catch (err) {
        console.error('[DESERCIONES] Error obteniendo plantillas:', err);
        return res.status(500).json({ error: 'Error al obtener plantillas de deserción.' });
    }
});

router.post('/templates', requireAuth, async (req, res) => {
    try {
        const incoming = req.body?.templates || req.body || {};
        let existingSaved = {};
        try {
            const curRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_templates_v2'");
            if (curRes.rows && curRes.rows.length > 0 && curRes.rows[0].value) {
                existingSaved = JSON.parse(curRes.rows[0].value) || {};
            }
        } catch (_) {}

        const mergedToSave = {
            ...DEFAULT_DESERCIONES_TEMPLATES,
            ...existingSaved,
            ...incoming,
            comite_defaults: {
                ...DEFAULT_DESERCIONES_TEMPLATES.comite_defaults,
                ...(existingSaved.comite_defaults || {}),
                ...(incoming.comite_defaults || {})
            }
        };
        await pool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('sena_deserciones_templates_v2', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify(mergedToSave)]);
        return res.json({
            success: true,
            message: 'Plantillas de Citación, Notificación Aprendiz y Resolución guardadas permanentemente como predeterminadas en el servidor.',
            templates: mergedToSave
        });
    } catch (err) {
        console.error('[DESERCIONES] Error guardando plantillas:', err);
        return res.status(500).json({ error: 'Error al guardar plantillas en el servidor.' });
    }
});

router.post('/cc-emails', requireAuth, async (req, res) => {
    const { cc_emails } = req.body;
    if (!Array.isArray(cc_emails)) {
        return res.status(400).json({ error: 'El formato de correos CC debe ser una lista.' });
    }
    try {
        const valueStr = JSON.stringify(cc_emails);
        await pool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('sena_deserciones_cc_emails', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [valueStr]);

        res.json({ message: 'Correos en Copia (CC) guardados y almacenados exitosamente en el sistema.', cc_emails });
    } catch (err) {
        console.error('[DESERCIONES] Error guardando correos CC:', err);
        res.status(500).json({ error: 'Error al almacenar correos CC.' });
    }
});

// Helper: convertir números seriales de fecha de Excel (ej. 46301 -> 06/10/2026)
function formatExcelSerialDate(colKey, rawVal) {
    if (rawVal === undefined || rawVal === null || rawVal === '') return '';
    const strVal = String(rawVal).trim();
    const keyLow = String(colKey || '').toLowerCase();
    const isDateCol = keyLow.includes('fecha') || keyLow.includes('date') || keyLow.includes('reporte') || keyLow.includes('comite') || keyLow.includes('comité');
    if (isDateCol && /^\d{5}(?:\.\d+)?$/.test(strVal)) {
        const serial = Math.floor(Number(strVal));
        if (serial >= 35000 && serial <= 65000) {
            const utcMs = Math.round((serial - 25569) * 86400 * 1000);
            const dt = new Date(utcMs);
            const dd = String(dt.getUTCDate()).padStart(2, '0');
            const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = dt.getUTCFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
    }
    return strVal;
}

function buildDesercionesProcessedPayload(rawData, filenameLabel, filePath = '') {
    if (!rawData || rawData.length === 0) {
        throw new Error('El archivo Excel está vacío o no tiene un formato válido.');
    }

    // Limpiar columnas vacías tipo __EMPTY, __EMPTY_1
    const columns = Object.keys(rawData[0] || {}).filter(c => !/^__EMPTY/i.test(String(c).trim()) && String(c).trim() !== '');

    const processedRows = rawData.map((origRow, index) => {
        const row = {};
        Object.keys(origRow).forEach(k => {
            if (/^__EMPTY/i.test(String(k).trim())) return;
            row[k] = formatExcelSerialDate(k, origRow[k]);
        });

        const getVal = (possibleKeys, excludeTerms = []) => {
            const isExcluded = (rk) => {
                const low = rk.toLowerCase().trim();
                return excludeTerms.some(ex => low.includes(ex.toLowerCase()));
            };
            for (const k of possibleKeys) {
                const exactKey = Object.keys(row).find(rk => !isExcluded(rk) && rk.toLowerCase().trim() === k.toLowerCase().trim());
                if (exactKey && row[exactKey] !== undefined && row[exactKey] !== null && String(row[exactKey]).trim() !== '') {
                    return String(row[exactKey]).trim();
                }
            }
            for (const k of possibleKeys) {
                const partialKey = Object.keys(row).find(rk => !isExcluded(rk) && rk.toLowerCase().includes(k.toLowerCase()));
                if (partialKey && row[partialKey] !== undefined && row[partialKey] !== null && String(row[partialKey]).trim() !== '') {
                    return String(row[partialKey]).trim();
                }
            }
            return '';
        };

        const excludeAcudiente = ['acudiente', 'representante', 'padre', 'madre', 'tutor'];

        const nombres = getVal(['nombre', 'nombres', 'primer_nombre', 'aprendiz_nombre'], excludeAcudiente);
        const apellidos = getVal(['apellidos', 'apellido', 'primer_apellido', 'aprendiz_apellido'], excludeAcudiente);
        const rawNombreComp = getVal(['aprendiz', 'nombre_aprendiz', 'nombres_y_apellidos', 'nombre_completo', 'nombres_apellidos'], excludeAcudiente);

        let nombreCompleto = rawNombreComp;
        if (!nombreCompleto) {
            if (nombres && apellidos) {
                nombreCompleto = `${nombres} ${apellidos}`;
            } else {
                nombreCompleto = nombres || apellidos || '';
            }
        }

        const tipoDoc = (getVal(['tipo', 'tipo_doc', 'tipo_documento', 'td', 'tipo_id', 'tipo_doc_aprendiz'], excludeAcudiente) || 'CC').toUpperCase();
        const numDoc = getVal(['documento', 'num_documento', 'identificacion', 'cedula', 'numero_documento', 'no_documento', 'nip', 'num_id', 'numero_id', 'id_aprendiz', 'doc'], excludeAcudiente);
        const correoSofia = getVal(['correo registrado en sofía', 'correo registrado en sofia', 'correo_sofia', 'correo_electronico', 'correo electrónico', 'correo', 'email', 'correo_aprendiz', 'mail', 'correo_notificacion'], excludeAcudiente);
        const acudienteNombre = getVal([
            'nombre acudiente', 'nombre_acudiente', 'acudiente_nombre', 'nombre del acudiente',
            'representante legal', 'representante_legal', 'nombre representante', 'padre o acudiente', 'acudiente'
        ], ['correo', 'email', 'mail']);
        const acudienteCorreo = getVal([
            'correo acudiente', 'correo_acudiente', 'acudiente_correo', 'correo del acudiente',
            'email acudiente', 'email_acudiente', 'correo electronico acudiente', 'correo electrónico acudiente',
            'correo representante', 'email representante', 'correo padre', 'correo madre', 'correo_notificacion'
        ]);
        const inasistenciaDesde = getVal(['inasistencia desde', 'inasistencia_desde', 'fechas_inasistencia']);
        const inasistenciaHasta = getVal(['hasta', 'inasistencia_hasta']);
        const fechasInasistencia = inasistenciaDesde && inasistenciaHasta
            ? `${inasistenciaDesde} — ${inasistenciaHasta}`
            : (inasistenciaDesde || inasistenciaHasta || 'Según reporte adjunto del instructor');

        return {
            id_temp: `row-${index + 1}`,
            ficha: getVal(['ficha', 'num_ficha', 'numero_ficha', 'codigo_ficha']),
            nivel: getVal(['nivel', 'nivel_formacion']),
            programa: getVal(['programa', 'programa_formacion', 'nombre_programa']),
            tipo_formacion: getVal(['tipo formacion', 'tipo_formacion', 'modalidad']),
            aprendiz_nombres: nombres,
            aprendiz_apellidos: apellidos,
            aprendiz_nombre: nombreCompleto || 'APRENDIZ',
            aprendiz_doc_tipo: tipoDoc,
            aprendiz_doc_numero: numDoc,
            aprendiz_correo: correoSofia,
            acudiente_nombre: acudienteNombre,
            acudiente_correo: acudienteCorreo,
            instructor: getVal(['instructor', 'nombre_instructor']),
            fecha_reporte: getVal(['fecha reporte', 'fecha_reporte']),
            estado: getVal(['estado', 'estado_sofia']) || 'MATRICULADO',
            inasistencia_desde: inasistenciaDesde,
            hasta: inasistenciaHasta,
            fechas_inasistencia: fechasInasistencia,
            causal_desercion: getVal(['causal', 'causal_desercion', 'motivo', 'razon_desercion']) || 'POR INASISTENCIAS',
            fecha_comite: getVal(['fecha_comite', 'fecha_citacion']),
            hora_comite: getVal(['hora_comite', 'hora', 'hora_citacion']),
            lugar_comite: getVal(['lugar_comite', 'lugar', 'enlace', 'ubicacion']),
            resolucion: getVal(['resolucion', 'resolución', 'num_resolucion', 'numero_resolucion', 'no_resolucion', 'no._resolucion', 'acto_administrativo', 'comunicacion']),
            es_menor_ti: tipoDoc === 'TI',
            raw_row: row
        };
    });

    const totalTi = processedRows.filter(r => r.aprendiz_doc_tipo === 'TI').length;
    const totalMayores = processedRows.length - totalTi;

    return {
        message: 'Excel procesado exitosamente',
        filename: filenameLabel || (filePath ? path.basename(filePath) : 'Excel_Deserciones.xlsx'),
        filepath: filePath || '',
        columns,
        total: processedRows.length,
        total_ti: totalTi,
        total_mayores: totalMayores,
        rows: processedRows
    };
}

function parseExcelWorkbookToRows(filePath, filenameLabel) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    return buildDesercionesProcessedPayload(rawData, filenameLabel, filePath);
}

// 1. Carga y parseo de Excel con registros de aprendices
router.post('/upload-excel', requireAuth, upload.single('excel'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha adjuntado ningún archivo Excel.' });
        }
        const parsed = parseExcelWorkbookToRows(req.file.path, req.file.originalname || req.file.filename);
        res.json(parsed);
    } catch (err) {
        console.error('[DESERCIONES] Error procesando Excel:', err);
        res.status(500).json({ error: `Error procesando el archivo Excel: ${err.message}` });
    }
});

// 1.1 Recargar automáticamente el último Excel subido al servidor (o reconstruirlo desde BD sin lanzar 404 en consola)
router.get('/latest-excel', requireAuth, async (req, res) => {
    try {
        const candidateDirs = listCandidateDesercionesDirs();
        const excelFiles = [];
        for (const dir of candidateDirs) {
            for (const f of fs.readdirSync(dir)) {
                if (!/\.(xlsx|xls)$/i.test(f)) continue;
                const full = path.join(dir, f);
                try {
                    const st = fs.statSync(full);
                    excelFiles.push({ name: f, fullPath: full, mtime: st.mtimeMs });
                } catch (_) {}
            }
        }
        excelFiles.sort((a, b) => b.mtime - a.mtime);

        if (excelFiles.length > 0) {
            const latest = excelFiles[0];
            const parsed = parseExcelWorkbookToRows(latest.fullPath, latest.name);
            return res.json(parsed);
        }

        // Fallback inteligente: reconstruir el último lote de Excel directamente desde PostgreSQL (deserciones_casos.raw_row)
        const latestBatchRes = await pool.query(`
            SELECT lote_id, archivo_excel
            FROM deserciones_casos
            WHERE raw_row IS NOT NULL
            ORDER BY id DESC
            LIMIT 1
        `);
        if (latestBatchRes.rowCount > 0) {
            const { lote_id, archivo_excel } = latestBatchRes.rows[0];
            const dbRowsRes = lote_id
                ? await pool.query(
                    `SELECT DISTINCT ON (COALESCE(excel_row_index, id)) raw_row, excel_row_index
                     FROM deserciones_casos
                     WHERE lote_id = $1 AND raw_row IS NOT NULL
                     ORDER BY COALESCE(excel_row_index, id) ASC`,
                    [lote_id]
                )
                : await pool.query(
                    `SELECT raw_row, excel_row_index
                     FROM deserciones_casos
                     WHERE archivo_excel IS NOT DISTINCT FROM $1 AND raw_row IS NOT NULL
                     ORDER BY COALESCE(excel_row_index, id) ASC`,
                    [archivo_excel]
                );
            const rawList = (dbRowsRes.rows || [])
                .map(r => (typeof r.raw_row === 'string' ? JSON.parse(r.raw_row) : r.raw_row))
                .filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);
            if (rawList.length > 0) {
                const parsedFromDb = buildDesercionesProcessedPayload(
                    rawList,
                    archivo_excel || 'Ultimo_Excel_Deserciones.xlsx',
                    ''
                );
                return res.json(parsedFromDb);
            }
        }

        // Responder 200 vacío en vez de 404 para evitar errores rojos en la consola del navegador
        return res.json({
            empty: true,
            message: 'No hay archivos Excel cargados recientemente.',
            filename: null,
            filepath: '',
            columns: [],
            total: 0,
            total_ti: 0,
            total_mayores: 0,
            rows: []
        });
    } catch (err) {
        console.error('[DESERCIONES] Error cargando último Excel:', err);
        return res.status(500).json({ error: `Error al recargar el último Excel: ${err.message}` });
    }
});

// 2. Subida de Anexo Explícito (PDF/Doc) para citación a comité o resolución
router.post('/upload-anexo', requireAuth, upload.single('anexo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se adjuntó ningún archivo de anexo.' });
        }
        res.json({
            message: 'Anexo subido correctamente',
            originalName: req.file.originalname,
            path: req.file.path,
            filename: req.file.filename
        });
    } catch (err) {
        console.error('[DESERCIONES] Error subiendo anexo:', err);
        res.status(500).json({ error: 'Error al subir el archivo de anexo.' });
    }
});

// 2.1 Carga masiva de paquete de anexos (PDFs/Documentos en lote)
router.post('/upload-masivo-anexos', requireAuth, upload.array('anexos', 200), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se adjuntó ningún paquete de anexos.' });
        }
        const uploadedFiles = req.files.map(f => ({
            originalName: f.originalname,
            path: f.path,
            filename: f.filename
        }));

        res.json({
            message: `Se subieron ${uploadedFiles.length} archivos de anexos en paquete exitosamente.`,
            files: uploadedFiles
        });
    } catch (err) {
        console.error('[DESERCIONES] Error en carga masiva de anexos:', err);
        res.status(500).json({ error: 'Error procesando la carga masiva de anexos.' });
    }
});

// Helper de fusión de texto inicial con campos de fila (incluye soporte para fechas seriales de Excel y valores por defecto de Comité)
const mergeText = (template, row, comiteDefaults = null) => {
    if (!template) return '';
    let merged = template;
    const defComite = {
        ...DEFAULT_DESERCIONES_TEMPLATES.comite_defaults,
        ...(comiteDefaults || {})
    };

    const rawInasDesde = row.inasistencia_desde || row.raw_row?.['INASISTENCIA DESDE'] || '';
    const rawInasHasta = row.hasta || row.raw_row?.['HASTA'] || '';
    const fechasInasistencia = row.fechas_inasistencia || (
        rawInasDesde && rawInasHasta
            ? `${rawInasDesde} — ${rawInasHasta}`
            : (rawInasDesde || rawInasHasta || 'Según reporte adjunto del instructor')
    );

    const rawFechaReporte = formatExcelSerialDate(
        'FECHA REPORTE',
        row.fecha_reporte || row.raw_row?.['FECHA REPORTE'] || row.raw_row?.['FECHA_REPORTE'] || ''
    );

    const replacements = {
        'nombre': row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || row.aprendiz_nombre || '',
        'nombres': row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || row.aprendiz_nombre || '',
        'apellidos': row.aprendiz_apellidos || row.raw_row?.['APELLIDOS'] || '',
        'aprendiz_nombre': row.aprendiz_nombre || [row.aprendiz_nombres, row.aprendiz_apellidos].filter(Boolean).join(' ') || '',
        'aprendiz_nombres': row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || '',
        'aprendiz_apellidos': row.aprendiz_apellidos || row.raw_row?.['APELLIDOS'] || '',
        'tipo': row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || 'CC',
        'aprendiz_doc_tipo': row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || 'CC',
        'documento': row.aprendiz_doc_numero || row.raw_row?.['DOCUMENTO'] || '',
        'aprendiz_doc_numero': row.aprendiz_doc_numero || row.raw_row?.['DOCUMENTO'] || '',
        'ficha': row.ficha || row.raw_row?.['FICHA'] || '',
        'nivel': row.nivel || row.raw_row?.['NIVEL'] || 'FORMACIÓN TITULADA',
        'programa': row.programa || row.raw_row?.['PROGRAMA'] || '',
        'tipo formacion': row.tipo_formacion || row.raw_row?.['TIPO FORMACION'] || 'PRESENCIAL',
        'tipo_formacion': row.tipo_formacion || row.raw_row?.['TIPO FORMACION'] || 'PRESENCIAL',
        'correo': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
        'correo registrado en sofía': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
        'correo registrado en sofia': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
        'aprendiz_correo': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
        'instructor': row.instructor || row.raw_row?.['INSTRUCTOR'] || 'Instructor de la Ficha',
        'fecha reporte': rawFechaReporte || new Date().toLocaleDateString('es-CO'),
        'fecha_reporte': rawFechaReporte || new Date().toLocaleDateString('es-CO'),
        'estado': row.estado || row.raw_row?.['ESTADO'] || 'MATRICULADO',
        'inasistencia desde': rawInasDesde,
        'inasistencia_desde': rawInasDesde,
        'hasta': rawInasHasta,
        'fechas_inasistencia': fechasInasistencia,
        'fechas inasistencia': fechasInasistencia,
        'causal_desercion': row.causal_desercion || defComite.causal_desercion || 'POR INASISTENCIAS',
        'causal': row.causal_desercion || defComite.causal_desercion || 'POR INASISTENCIAS',
        'fecha_comite': formatExcelSerialDate('fecha_comite', row.fecha_comite) || defComite.fecha_comite,
        'fecha comite': formatExcelSerialDate('fecha_comite', row.fecha_comite) || defComite.fecha_comite,
        'hora_comite': row.hora_comite || defComite.hora_comite,
        'hora comite': row.hora_comite || defComite.hora_comite,
        'lugar_comite': row.lugar_comite || defComite.lugar_comite,
        'lugar comite': row.lugar_comite || defComite.lugar_comite,
        'acudiente': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
        'nombre_acudiente': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
        'nombre acudiente': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
        'acudiente_nombre': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
        'correo_acudiente': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
        'correo acudiente': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
        'acudiente_correo': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
        'email_acudiente': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
        'resolucion': row.resolucion || row.raw_row?.['RESOLUCION'] || row.raw_row?.['RESOLUCIÓN'] || '',
        'resolución': row.resolucion || row.raw_row?.['RESOLUCION'] || row.raw_row?.['RESOLUCIÓN'] || '',
        'fecha_actual': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
        'fecha actual': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    const normKey = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    const normalizedMap = {};

    // Reemplazo dinámico de variables predefinidas en múltiples sintaxis
    Object.keys(replacements).forEach(key => {
        const val = replacements[key] !== undefined && replacements[key] !== null ? String(replacements[key]) : '';
        normalizedMap[normKey(key)] = val;
        const escKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const patterns = [
            new RegExp(`\\{\\{\\s*${escKey}\\s*\\}\\}`, 'gi'),
            new RegExp(`«\\s*${escKey}\\s*[_.]*\\s*»`, 'gi'),
            new RegExp(`<<\\s*${escKey}\\s*>>`, 'gi'),
            new RegExp(`\\[\\s*${escKey}\\s*\\]`, 'gi')
        ];
        patterns.forEach(p => { merged = merged.replace(p, val); });
    });

    // Reemplazo de variables genéricas de columnas del Excel (exacto + normalizado sin tildes/guiones bajos + conversión de fecha serial)
    if (row.raw_row && typeof row.raw_row === 'object') {
        Object.keys(row.raw_row).forEach(colKey => {
            const rawVal = row.raw_row[colKey] !== undefined && row.raw_row[colKey] !== null ? row.raw_row[colKey] : '';
            const val = formatExcelSerialDate(colKey, rawVal);
            normalizedMap[normKey(colKey)] = val;
            const escCol = colKey.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const patterns = [
                new RegExp(`\\{\\{\\s*${escCol}\\s*\\}\\}`, 'gi'),
                new RegExp(`«\\s*${escCol}\\s*[_.]*\\s*»`, 'gi'),
                new RegExp(`<<\\s*${escCol}\\s*>>`, 'gi'),
                new RegExp(`\\[\\s*${escCol}\\s*\\]`, 'gi')
            ];
            patterns.forEach(pattern => {
                merged = merged.replace(pattern, val);
            });
        });
    }

    // Segunda pasada tolerante a tildes/espacios/guiones bajos (ej. {{FECHA RESOLUCION}} vs FECHA_RESOLUCIÓN, {{FECHA REPORTE}}, etc.)
    merged = merged.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (fullMatch, tokenName) => {
        const nk = normKey(tokenName);
        return Object.prototype.hasOwnProperty.call(normalizedMap, nk) ? normalizedMap[nk] : fullMatch;
    });

    return merged;
};

// 3. Vista previa de correspondencia combinada (incluye soporte automático CC vs TI)
router.post('/preview-merge', requireAuth, (req, res) => {
    const {
        template,
        template_ti,
        asunto,
        descripcion_asunto,
        descripcion_asunto_ti,
        auto_ti_template = true,
        comite_defaults,
        row
    } = req.body;
    if (!row) {
        return res.status(400).json({ error: 'Datos de registro requeridos para la vista previa.' });
    }

    const tipoDoc = String(row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || 'CC').trim().toUpperCase();
    const isTi = tipoDoc === 'TI';
    const effectiveTemplate = (isTi && auto_ti_template && template_ti) ? template_ti : template;
    const effectiveDescAsunto = (isTi && auto_ti_template && descripcion_asunto_ti) ? descripcion_asunto_ti : descripcion_asunto;

    const merged = mergeText(effectiveTemplate, row, comite_defaults);
    const mergedAsunto = asunto ? mergeText(asunto, row, comite_defaults) : '';
    const mergedDescripcionAsunto = effectiveDescAsunto ? mergeText(effectiveDescAsunto, row, comite_defaults) : '';
    const unmergedTokens = Array.from(new Set(
        (`${merged} ${mergedAsunto} ${mergedDescripcionAsunto}`.match(/(\{\{\s*[^}]+\s*\}\}|«\s*[^»]+\s*»|<<\s*[^>]+>>)/g) || [])
    ));
    res.json({
        mergedText: merged,
        mergedAsunto,
        mergedDescripcionAsunto,
        appliedTemplateType: isTi && auto_ti_template && template_ti ? 'MENOR_TI' : 'MAYOR_CC',
        unmergedTokens
    });
});

// 4. Guardar casos y preparar comunicaciones (con selección automática de plantilla Mayor CC vs Menor TI y guardado en BD)
router.post('/guardar-casos', requireAuth, async (req, res) => {
    const {
        etapa,
        casos,
        texto_inicial,
        texto_inicial_ti,
        asunto = 'NOVEDADES DE ALUMNOS',
        descripcion_asunto = 'Notificación',
        descripcion_asunto_ti,
        auto_ti_template = true,
        comite_defaults,
        onbase_target_user,
        copy_emails,
        generate_pdf = true,
        lote_id,
        archivo_excel,
        archivo_excel_path,
        excel_columns
    } = req.body;

    if (!etapa || !casos || !Array.isArray(casos) || casos.length === 0) {
        return res.status(400).json({ error: 'Datos de casos incompletos o inválidos.' });
    }

    let browser = null;
    let pdfPage = null;

    try {
        await ensureDesercionesTable();

        const effectiveCopyEmails = (Array.isArray(copy_emails) && copy_emails.length > 0)
            ? copy_emails
            : DEFAULT_CIMI_CC_EMAILS;
        const copyEmailsStr = typeof copy_emails === 'string' ? copy_emails : JSON.stringify(effectiveCopyEmails);
        const cleanArchivoExcel = String(archivo_excel || 'Carga_Masiva.xlsx').trim();
        const etapaShortLabel = etapa === 'CITACION_COMITE'
            ? 'CITACION'
            : etapa === 'NOTIFICACION_APRENDIZ'
                ? 'NOTIF_APRENDIZ'
                : 'RESOLUCION';
        const effectiveLoteId = String(
            lote_id ||
            `LOTE-${etapaShortLabel}-${cleanArchivoExcel.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase().slice(0, 36)}`
        ).trim();
        const effectiveExcelCols = Array.isArray(excel_columns) && excel_columns.length > 0
            ? excel_columns
            : (casos[0]?.raw_row ? Object.keys(casos[0].raw_row).filter(k => !/^__EMPTY/i.test(k)) : []);
        // REGLA OFICIAL SENA: Citación a Comité y Notificación Aprendiz van directo en el cuerpo de OnBase (sin anexo PDF obligatorio); Notificación de Resolución sí lleva PDF
        const allowPdfForEtapa = Boolean(generate_pdf) && etapa !== 'CITACION_COMITE' && etapa !== 'NOTIFICACION_APRENDIZ';
        const outputDir = path.join(__dirname, '..', 'uploads', 'deserciones_pdf');
        if (allowPdfForEtapa && !fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (allowPdfForEtapa) {
            try {
                browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });
                pdfPage = await browser.newPage();
            } catch (e) {
                console.warn('[DESERCIONES] Advertencia lanzando Puppeteer:', e.message);
            }
        }

        const createdRecords = [];

        let countMayor = 0;
        let countMenorTi = 0;

        for (let idx = 0; idx < casos.length; idx++) {
            const item = casos[idx];
            const tipoDocItem = String(item.aprendiz_doc_tipo || item.raw_row?.['TIPO'] || 'CC').trim().toUpperCase();
            const isMenorTi = tipoDocItem === 'TI';
            const tplForItem = (isMenorTi && auto_ti_template && texto_inicial_ti) ? texto_inicial_ti : texto_inicial;
            const descForItem = (isMenorTi && auto_ti_template && descripcion_asunto_ti) ? descripcion_asunto_ti : (descripcion_asunto || 'Notificación');
            if (isMenorTi && auto_ti_template && texto_inicial_ti) countMenorTi++;
            else countMayor++;

            const textoCombinado = mergeText(tplForItem, item, comite_defaults);
            let pdfPath = '';

            // Generar PDF usando Puppeteer reutilizando la pestaña (10x más rápido y sin timeout HTTP/2)
            if (browser && pdfPage) {
                try {
                    const htmlContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 40px; color: #222; }
                                .header { text-align: center; border-bottom: 2px solid #39a900; padding-bottom: 15px; margin-bottom: 25px; }
                                .header img { width: 90px; }
                                .title { font-size: 14pt; font-weight: bold; color: #00324d; margin-top: 10px; }
                                .ref { font-size: 10pt; text-align: right; margin-bottom: 20px; color: #555; }
                                .recipient { font-weight: bold; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-left: 4px solid #39a900; }
                                .content { white-space: pre-wrap; text-align: justify; margin-bottom: 40px; }
                                .footer { text-align: center; font-size: 9pt; color: #777; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 50px; }
                            </style>
                        </head>
                        <body>
                            <div class="header">
                                <div class="title">SERVICIO NACIONAL DE APRENDIZAJE - SENA</div>
                                <div>COMUNICACIÓN OFICIAL - PROCESO DE DESERCIÓN (${etapa === 'CITACION_COMITE' ? 'CITACIÓN A COMITÉ' : 'NOTIFICACIÓN DE RESOLUCIÓN'})</div>
                            </div>
                            <div class="ref">
                                Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}
                            </div>
                            <div class="recipient">
                                Señor(a): ${item.aprendiz_nombre || 'APRENDIZ'}<br>
                                Documento: ${item.aprendiz_doc_tipo || 'CC'} ${item.aprendiz_doc_numero || ''}<br>
                                Ficha: ${item.ficha || 'N/A'} - Programa: ${item.programa || 'N/A'}<br>
                                Correo: ${item.aprendiz_correo || 'N/A'}
                            </div>
                            <div class="content">
                                ${textoCombinado}
                            </div>
                            <div class="footer">
                                SENA - Centro Industrial de Mantenimiento Integral CIMI - Regional Santander
                            </div>
                        </body>
                        </html>
                    `;

                    await pdfPage.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
                    const fileName = `Comunicacion_${etapa}_${item.aprendiz_doc_numero || Date.now()}_${Date.now()}.pdf`;
                    pdfPath = path.join(outputDir, fileName);
                    await pdfPage.pdf({ path: pdfPath, format: 'Letter', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } });
                } catch (pdfErr) {
                    console.error('[DESERCIONES] Error generando PDF individual:', pdfErr);
                }
            }

            // Si ya existe un caso 'Pendiente' idéntico (mismo documento + ficha + etapa), actualizarlo en vez de duplicarlo
            const docNumClean = String(item.aprendiz_doc_numero || '').trim();
            const fichaClean = String(item.ficha || '').trim();
            const existingPend = docNumClean
                ? await pool.query(
                    `SELECT id FROM deserciones_casos
                     WHERE etapa = $1 AND aprendiz_doc_numero = $2 AND ficha = $3 AND status = 'Pendiente'
                     ORDER BY id DESC LIMIT 1`,
                    [etapa, docNumClean, fichaClean]
                )
                : { rows: [] };

            const acudienteNombreItem = String(
                item.acudiente_nombre ||
                item.raw_row?.['NOMBRE ACUDIENTE'] ||
                item.raw_row?.['ACUDIENTE'] ||
                item.raw_row?.['REPRESENTANTE LEGAL'] ||
                ''
            ).trim();
            const acudienteCorreoItem = String(
                item.acudiente_correo ||
                item.raw_row?.['CORREO ACUDIENTE'] ||
                item.raw_row?.['EMAIL ACUDIENTE'] ||
                item.raw_row?.['CORREO REPRESENTANTE'] ||
                ''
            ).trim();

            // Construir lista de copias (CC) INDEPENDIENTE para este aprendiz específico:
            // Si el aprendiz tiene correo de acudiente, se agrega de primero en las copias de este caso únicamente.
            const baseCcArray = Array.isArray(effectiveCopyEmails) ? effectiveCopyEmails.filter(c => !c.is_acudiente) : [];
            const caseSpecificCc = [...baseCcArray];
            if (acudienteCorreoItem && acudienteCorreoItem.includes('@')) {
                const acEmails = acudienteCorreoItem.split(/[;,]+/).map(s => s.trim()).filter(s => s.includes('@'));
                const labelAcudiente = acudienteNombreItem || `Acudiente de ${item.aprendiz_nombre || 'Aprendiz'}`;
                for (let acIdx = acEmails.length - 1; acIdx >= 0; acIdx--) {
                    const acMail = acEmails[acIdx];
                    if (!caseSpecificCc.some(c => String(c.email || '').toLowerCase() === acMail.toLowerCase())) {
                        caseSpecificCc.unshift({
                            name: labelAcudiente,
                            email: acMail,
                            is_acudiente: true
                        });
                    }
                }
            }
            const caseCopyEmailsStr = JSON.stringify(caseSpecificCc);

            const rawRowObj = item.raw_row && typeof item.raw_row === 'object' ? { ...item.raw_row } : {
                'No.': idx + 1,
                'TIPO': tipoDocItem || 'CC',
                'DOCUMENTO': docNumClean,
                'NOMBRE': item.aprendiz_nombres || item.aprendiz_nombre || '',
                'APELLIDOS': item.aprendiz_apellidos || '',
                'CORREO REGISTRADO EN SOFÍA': item.aprendiz_correo || '',
                'FICHA': fichaClean,
                'PROGRAMA': item.programa || ''
            };
            if (acudienteNombreItem) rawRowObj['NOMBRE ACUDIENTE'] = acudienteNombreItem;
            if (acudienteCorreoItem) rawRowObj['CORREO ACUDIENTE'] = acudienteCorreoItem;
            const rowOrderIdx = Number(rawRowObj['No.']) || (idx + 1);

            let queryRes;
            if (existingPend.rows && existingPend.rows.length > 0) {
                queryRes = await pool.query(`
                    UPDATE deserciones_casos SET
                        programa = $2,
                        aprendiz_nombre = $3,
                        aprendiz_doc_tipo = $4,
                        aprendiz_correo = $5,
                        causal_desercion = $6,
                        fecha_comite = $7,
                        hora_comite = $8,
                        lugar_comite = $9,
                        texto_inicial = $10,
                        texto_combinado = $11,
                        asunto = $12,
                        descripcion_asunto = $13,
                        comunicacion_pdf_path = $14,
                        anexo_path = CASE WHEN $15 <> '' THEN $15 ELSE anexo_path END,
                        onbase_target_user = $16,
                        copy_emails = $17,
                        lote_id = $18,
                        archivo_excel = $19,
                        archivo_excel_path = COALESCE(NULLIF($20, ''), archivo_excel_path),
                        raw_row = $21::jsonb,
                        excel_columns = $22::jsonb,
                        excel_row_index = $23,
                        acudiente_nombre = $24,
                        acudiente_correo = $25,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                `, [
                    existingPend.rows[0].id,
                    item.programa || '',
                    item.aprendiz_nombre || '',
                    tipoDocItem || 'CC',
                    item.aprendiz_correo || '',
                    item.causal_desercion || '',
                    item.fecha_comite || '',
                    item.hora_comite || '',
                    item.lugar_comite || '',
                    tplForItem || '',
                    textoCombinado,
                    mergeText(asunto || 'NOVEDADES DE ALUMNOS', item, comite_defaults),
                    mergeText(descForItem, item, comite_defaults),
                    pdfPath,
                    item.anexo_path || '',
                    onbase_target_user || '',
                    caseCopyEmailsStr,
                    effectiveLoteId,
                    cleanArchivoExcel,
                    archivo_excel_path || '',
                    JSON.stringify(rawRowObj),
                    JSON.stringify(effectiveExcelCols),
                    rowOrderIdx,
                    acudienteNombreItem,
                    acudienteCorreoItem
                ]);
            } else {
                queryRes = await pool.query(`
                    INSERT INTO deserciones_casos (
                        etapa, ficha, programa, aprendiz_nombre, aprendiz_doc_tipo, aprendiz_doc_numero,
                        aprendiz_correo, causal_desercion, fecha_comite, hora_comite, lugar_comite,
                        texto_inicial, texto_combinado, asunto, descripcion_asunto, comunicacion_pdf_path, anexo_path,
                        onbase_target_user, copy_emails, status,
                        lote_id, archivo_excel, archivo_excel_path, raw_row, excel_columns, excel_row_index,
                        acudiente_nombre, acudiente_correo
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'Pendiente', $20, $21, $22, $23::jsonb, $24::jsonb, $25, $26, $27)
                    RETURNING *
                `, [
                    etapa,
                    fichaClean,
                    item.programa || '',
                    item.aprendiz_nombre || '',
                    tipoDocItem || 'CC',
                    docNumClean,
                    item.aprendiz_correo || '',
                    item.causal_desercion || '',
                    item.fecha_comite || '',
                    item.hora_comite || '',
                    item.lugar_comite || '',
                    tplForItem || '',
                    textoCombinado,
                    mergeText(asunto || 'NOVEDADES DE ALUMNOS', item, comite_defaults),
                    mergeText(descForItem, item, comite_defaults),
                    pdfPath,
                    item.anexo_path || '',
                    onbase_target_user || '',
                    caseCopyEmailsStr,
                    effectiveLoteId,
                    cleanArchivoExcel,
                    archivo_excel_path || '',
                    JSON.stringify(rawRowObj),
                    JSON.stringify(effectiveExcelCols),
                    rowOrderIdx,
                    acudienteNombreItem,
                    acudienteCorreoItem
                ]);
            }

            if (queryRes.rows && queryRes.rows[0]) {
                const savedRow = queryRes.rows[0];
                if (item.resolucion) {
                    await pool.query('UPDATE deserciones_casos SET resolucion = $2 WHERE id = $1', [savedRow.id, String(item.resolucion).trim()]).catch(() => {});
                    savedRow.resolucion = String(item.resolucion).trim();
                }
                createdRecords.push(savedRow);
            }
        }

        res.json({
            message: `Se han procesado y guardado ${createdRecords.length} comunicaciones correctamente (${countMayor} Mayor de Edad CC/PPT y ${countMenorTi} Menor de Edad / Tarjeta de Identidad TI).`,
            casos: createdRecords,
            lote_id: effectiveLoteId,
            archivo_excel: cleanArchivoExcel,
            count_mayor: countMayor,
            count_menor_ti: countMenorTi
        });

    } catch (err) {
        console.error('[DESERCIONES] Error al guardar casos:', err);
        res.status(500).json({ error: `Error al procesar los casos de deserción: ${err.message}` });
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
});

// 5. Consultar casos de deserciones registrados (con búsqueda ampliada, filtro por lote y hasta 2000 registros)
router.get('/casos', requireAuth, async (req, res) => {
    const { etapa, status, ficha, search, lote_id } = req.query;
    try {
        await ensureDesercionesTable();
        let query = 'SELECT * FROM deserciones_casos WHERE 1=1';
        const params = [];

        if (etapa) {
            params.push(etapa);
            query += ` AND etapa = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        if (lote_id && lote_id !== 'Todos') {
            params.push(lote_id);
            query += ` AND lote_id = $${params.length}`;
        }
        if (ficha) {
            params.push(`%${ficha}%`);
            query += ` AND ficha ILIKE $${params.length}`;
        }
        if (search && String(search).trim()) {
            params.push(`%${String(search).trim()}%`);
            const p = `$${params.length}`;
            query += ` AND (aprendiz_doc_numero ILIKE ${p} OR aprendiz_nombre ILIKE ${p} OR ficha ILIKE ${p} OR aprendiz_correo ILIKE ${p} OR COALESCE(resolucion,'') ILIKE ${p} OR COALESCE(radicado,'') ILIKE ${p} OR COALESCE(nis,'') ILIKE ${p} OR COALESCE(fecha_radicado,'') ILIKE ${p})`;
        }

        query += ' ORDER BY id DESC LIMIT 2000';

        const result = await pool.query(query, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[DESERCIONES] Error consultando casos:', err);
        res.status(500).json({ error: 'Error consultando casos de deserción.' });
    }
});

// 5.1 Cuentas oficiales de OnBase desde organization_structure
router.get('/onbase-accounts', requireAuth, desercionesBotController.getOnBaseAccounts);

// 5.2 Listar lotes de carga masiva de Excel registrados en el sistema
router.get('/lotes', requireAuth, async (req, res) => {
    try {
        await ensureDesercionesTable();
        const result = await pool.query(`
            SELECT
                COALESCE(lote_id, 'SIN-LOTE') AS lote_id,
                etapa,
                MAX(COALESCE(archivo_excel, 'Carga_Masiva.xlsx')) AS archivo_excel,
                MAX(archivo_excel_path) AS archivo_excel_path,
                COUNT(*)::int AS total_casos,
                COUNT(*) FILTER (WHERE radicado IS NOT NULL AND TRIM(radicado) <> '')::int AS con_radicado,
                COUNT(*) FILTER (WHERE radicado IS NULL OR TRIM(radicado) = '')::int AS sin_radicado,
                MIN(created_at) AS fecha_inicio,
                MAX(COALESCE(enviado_at, updated_at, created_at)) AS ultima_actividad
            FROM deserciones_casos
            GROUP BY COALESCE(lote_id, 'SIN-LOTE'), etapa
            ORDER BY MAX(id) DESC
        `);

        const lotes = (result.rows || []).map(l => ({
            ...l,
            tiene_archivo_original: Boolean(l.archivo_excel_path && fs.existsSync(l.archivo_excel_path))
        }));

        res.json({ lotes });
    } catch (err) {
        console.error('[DESERCIONES] Error consultando lotes:', err);
        res.status(500).json({ error: `Error consultando lotes de carga masiva: ${err.message}` });
    }
});

// 5.3 Exportar Excel por Lote de Carga Masiva (IDÉNTICO al Excel subido al sistema + RADICADO, N.I.S. y FECHA RADICADO)
router.get('/exportar-excel-lote', requireAuth, async (req, res) => {
    const { lote_id, etapa, modo = 'original_completo' } = req.query;
    try {
        await ensureDesercionesTable();

        // Buscar registros del lote solicitado (o del lote más reciente si no se envía lote_id)
        let targetLoteId = lote_id;
        if (!targetLoteId || targetLoteId === 'Todos' || targetLoteId === 'ULTIMO') {
            const latestLoteRes = await pool.query(`
                SELECT lote_id FROM deserciones_casos
                WHERE ($1::text IS NULL OR etapa = $1)
                ORDER BY id DESC LIMIT 1
            `, [etapa || null]);
            targetLoteId = latestLoteRes.rows?.[0]?.lote_id || null;
        }

        let query = 'SELECT * FROM deserciones_casos WHERE 1=1';
        const params = [];
        if (targetLoteId && lote_id !== 'Todos') {
            params.push(targetLoteId);
            query += ` AND lote_id = $${params.length}`;
        }
        if (etapa) {
            params.push(etapa);
            query += ` AND etapa = $${params.length}`;
        }
        query += ' ORDER BY COALESCE(excel_row_index, id) ASC, id ASC';

        const dbRes = await pool.query(query, params);
        const casosLote = dbRes.rows || [];

        if (casosLote.length === 0) {
            return res.status(404).json({ error: 'No se encontraron registros para el lote seleccionado.' });
        }

        const sampleCase = casosLote.find(c => c.archivo_excel_path && fs.existsSync(c.archivo_excel_path)) || casosLote[0];
        const originalFileName = sampleCase.archivo_excel || 'Carga_Masiva_Deserciones.xlsx';
        const originalFilePath = sampleCase.archivo_excel_path || '';

        // Mapa rápido de casos en BD por fila de Excel, documento+ficha, documento, nombre+ficha y correo+ficha
        const normMatchKey = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
        const extractDocFromCase = (c) => {
            const direct = String(c.aprendiz_doc_numero || '').trim();
            if (direct) return direct;
            if (c.raw_row && typeof c.raw_row === 'object') {
                for (const k of ['NIP', 'nip', 'DOCUMENTO', 'documento', 'NUM_DOCUMENTO', 'IDENTIFICACION', 'CEDULA']) {
                    if (c.raw_row[k] !== undefined && c.raw_row[k] !== null && String(c.raw_row[k]).trim() !== '') {
                        return String(c.raw_row[k]).trim();
                    }
                }
            }
            return '';
        };

        const caseByRowIndex = new Map();
        const caseByDocFicha = new Map();
        const caseByDoc = new Map();
        const caseByNameFicha = new Map();
        const caseByEmailFicha = new Map();

        for (const c of casosLote) {
            const docKey = extractDocFromCase(c);
            const fichaKey = String(c.ficha || '').trim();
            const nameKey = normMatchKey(c.aprendiz_nombre);
            const emailKey = String(c.aprendiz_correo || '').trim().toLowerCase();
            if (c.excel_row_index !== null && c.excel_row_index !== undefined) {
                caseByRowIndex.set(Number(c.excel_row_index), c);
            }
            if (docKey) {
                caseByDoc.set(docKey, c);
                caseByDocFicha.set(`${docKey}__${fichaKey}`, c);
            }
            if (nameKey) {
                caseByNameFicha.set(`${nameKey}__${fichaKey}`, c);
            }
            if (emailKey) {
                caseByEmailFicha.set(`${emailKey}__${fichaKey}`, c);
            }
        }

        let baseRows = [];
        let baseColumns = [];

        // Si existe el archivo Excel físico original en el servidor y el modo es original_completo, reconstruir exactamente las filas de ese Excel
        if (modo !== 'solo_bd' && originalFilePath && fs.existsSync(originalFilePath)) {
            try {
                const parsedOrig = parseExcelWorkbookToRows(originalFilePath, originalFileName);
                baseColumns = parsedOrig.columns || [];
                baseRows = (parsedOrig.rows || []).map((r, idx) => {
                    const docKey = String(r.aprendiz_doc_numero || r.raw_row?.NIP || r.raw_row?.DOCUMENTO || '').trim();
                    const fichaKey = String(r.ficha || '').trim();
                    const nameKey = normMatchKey(r.aprendiz_nombre);
                    const emailKey = String(r.aprendiz_correo || '').trim().toLowerCase();

                    const matchedDb =
                        (docKey ? caseByDocFicha.get(`${docKey}__${fichaKey}`) : null) ||
                        (docKey ? caseByDoc.get(docKey) : null) ||
                        (nameKey ? caseByNameFicha.get(`${nameKey}__${fichaKey}`) : null) ||
                        (emailKey ? caseByEmailFicha.get(`${emailKey}__${fichaKey}`) : null) ||
                        (parsedOrig.rows.length === casosLote.length ? caseByRowIndex.get(idx + 1) : null);

                    return {
                        rawObj: { ...(r.raw_row || {}) },
                        radicado: matchedDb?.radicado || '',
                        nis: matchedDb?.nis || '',
                        fecha_radicado: matchedDb?.fecha_radicado || ''
                    };
                });
            } catch (exErr) {
                console.warn('[DESERCIONES] Usando raw_row de BD para exportar lote:', exErr.message);
            }
        }

        // Si no se leyó del archivo físico (o modo === 'solo_bd'), reconstruir directamente desde raw_row y excel_columns guardados en BD
        if (baseRows.length === 0) {
            const storedCols = Array.isArray(sampleCase.excel_columns) && sampleCase.excel_columns.length > 0
                ? sampleCase.excel_columns
                : (sampleCase.raw_row ? Object.keys(sampleCase.raw_row) : [
                    'No.', 'TIPO', 'DOCUMENTO', 'NOMBRE', 'APELLIDOS', 'CORREO REGISTRADO EN SOFÍA',
                    'FICHA', 'NIVEL', 'PROGRAMA', 'TIPO FORMACION', 'FECHA REPORTE', 'INSTRUCTOR',
                    'ESTADO', 'INASISTENCIA DESDE', 'HASTA'
                ]);
            baseColumns = storedCols.filter(c => !/^__EMPTY/i.test(String(c).trim()));
            baseRows = casosLote.map((c, idx) => {
                const raw = (c.raw_row && typeof c.raw_row === 'object') ? { ...c.raw_row } : {
                    'No.': idx + 1,
                    'TIPO': c.aprendiz_doc_tipo || 'CC',
                    'DOCUMENTO': c.aprendiz_doc_numero || '',
                    'NOMBRE': c.aprendiz_nombre || '',
                    'CORREO REGISTRADO EN SOFÍA': c.aprendiz_correo || '',
                    'FICHA': c.ficha || '',
                    'PROGRAMA': c.programa || '',
                    'RESOLUCION': c.resolucion || ''
                };
                return {
                    rawObj: raw,
                    radicado: c.radicado || '',
                    nis: c.nis || '',
                    fecha_radicado: c.fecha_radicado || ''
                };
            });
        }

        // Identificar si el Excel original ya tenía columnas para Radicado, NIS o Fecha
        const findColCaseInsensitive = (cols, candidates) => {
            for (const cand of candidates) {
                const found = cols.find(col => String(col).trim().toLowerCase() === cand.toLowerCase());
                if (found) return found;
            }
            return null;
        };

        const colRadicado = findColCaseInsensitive(baseColumns, ['radicado', 'no. radicado', 'numero radicado', 'radicado onbase']) || 'RADICADO';
        const colNis = findColCaseInsensitive(baseColumns, ['n.i.s.', 'nis', 'nis onbase']) || 'N.I.S.';
        const colFechaRad = findColCaseInsensitive(baseColumns, ['fecha radicado', 'fecha notificacion', 'fecha notificación', 'fecha_radicado']) || 'FECHA RADICADO';

        const finalColumns = [...baseColumns];
        if (!finalColumns.includes(colRadicado)) finalColumns.push(colRadicado);
        if (!finalColumns.includes(colNis)) finalColumns.push(colNis);
        if (!finalColumns.includes(colFechaRad)) finalColumns.push(colFechaRad);

        const sheetRows = baseRows.map(item => {
            const orderedRow = {};
            for (const colName of finalColumns) {
                if (colName === colRadicado) {
                    orderedRow[colName] = item.radicado || item.rawObj[colName] || '';
                } else if (colName === colNis) {
                    orderedRow[colName] = item.nis || item.rawObj[colName] || '';
                } else if (colName === colFechaRad) {
                    orderedRow[colName] = item.fecha_radicado || item.rawObj[colName] || '';
                } else {
                    const val = item.rawObj[colName] !== undefined ? item.rawObj[colName] : '';
                    orderedRow[colName] = formatExcelSerialDate(colName, val);
                }
            }
            return orderedRow;
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(sheetRows, { header: finalColumns });

        // Ajustar ancho automático de columnas para fácil lectura
        ws['!cols'] = finalColumns.map(col => {
            const maxCellLen = sheetRows.reduce((max, r) => {
                const len = String(r[col] ?? '').length;
                return len > max ? len : max;
            }, String(col).length);
            return { wch: Math.min(Math.max(maxCellLen + 3, 12), 48) };
        });

        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const cleanDownloadName = `RADICADOS_${originalFileName.replace(/[^a-zA-Z0-9._\-\s]/g, '')}`.replace(/\s+/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanDownloadName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
    } catch (err) {
        console.error('[DESERCIONES] Error exportando Excel del lote:', err);
        return res.status(500).json({ error: `Error exportando el Excel del lote: ${err.message}` });
    }
});

// ─────────────────────────────────────────────────────────────────
// 6. RUTAS DEL ROBOT INDEPENDIENTE DE DESERCIONES (AISLADO DE CARGUE AES)
// ─────────────────────────────────────────────────────────────────
const setBotLongTimeout = (req, res, next) => {
    req.setTimeout(600000);
    res.setTimeout(600000);
    next();
};

router.post('/bot/execute', requireAuth, setBotLongTimeout, desercionesBotController.executeDesercionesBot);
router.get('/bot/status', requireAuth, desercionesBotController.getDesercionesBotStatus);
router.get('/bot/frame', requireAuth, desercionesBotController.getDesercionesBotFrame);
router.post('/bot/kill', requireAuth, desercionesBotController.killDesercionesBot);
router.post('/bot/click', requireAuth, desercionesBotController.clickDesercionesPage);

// ─────────────────────────────────────────────────────────────────
// 6.0 RUTAS DE EXTRACCIÓN DE RADICADOS Y FECHAS DESDE CORREO (CARPETA PRODUCIDAS)
// ─────────────────────────────────────────────────────────────────
router.post('/email-sync/execute', requireAuth, setBotLongTimeout, desercionesEmailSyncController.executeEmailSyncBot);
router.get('/email-sync/status', requireAuth, desercionesEmailSyncController.getEmailSyncStatus);
router.get('/email-sync/frame', requireAuth, desercionesEmailSyncController.getEmailSyncFrame);
router.post('/email-sync/click', requireAuth, desercionesEmailSyncController.clickEmailSyncPage);
router.post('/email-sync/send-text', requireAuth, desercionesEmailSyncController.sendTextEmailSyncPage);
router.post('/email-sync/kill', requireAuth, desercionesEmailSyncController.killEmailSyncBot);
router.post('/email-sync/import-manual', requireAuth, upload.array('emails', 100), desercionesEmailSyncController.importManualEmailsOrText);

// Compatibilidad endpoint legado /cargue-onbase -> redirigido al Robot Independiente de Deserciones
router.post('/cargue-onbase', requireAuth, setBotLongTimeout, desercionesBotController.executeDesercionesBot);

// 6.1 Exportar Acta / Reporte Excel de Evidencia de Notificaciones de Deserción
router.get('/exportar-reporte', requireAuth, async (req, res) => {
    const { status, etapa, lote_id } = req.query;
    try {
        await ensureDesercionesTable();
        let query = 'SELECT * FROM deserciones_casos WHERE 1=1';
        const params = [];
        if (status && status !== 'Todos') {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        if (etapa) {
            params.push(etapa);
            query += ` AND etapa = $${params.length}`;
        }
        if (lote_id && lote_id !== 'Todos') {
            params.push(lote_id);
            query += ` AND lote_id = $${params.length}`;
        }
        query += ' ORDER BY id DESC';
        const result = await pool.query(query, params);

        const rows = (result.rows || []).map(c => ({
            'ID Caso': c.id,
            'Lote Excel': c.archivo_excel || c.lote_id || '',
            'Etapa': c.etapa === 'CITACION_COMITE' ? 'Citación a Comité' : c.etapa === 'NOTIFICACION_APRENDIZ' ? 'Notificación Aprendiz' : 'Notificación de Resolución',
            'Estado OnBase': c.status || 'Pendiente',
            'Tipo Doc': c.aprendiz_doc_tipo || 'CC',
            'Número Documento': c.aprendiz_doc_numero || '',
            'Aprendiz': c.aprendiz_nombre || '',
            'Correo Sofía Plus': c.aprendiz_correo || '',
            'Ficha': c.ficha || '',
            'Programa': c.programa || '',
            'Resolución': c.resolucion || '',
            'Asunto OnBase': c.asunto || 'NOVEDADES DE ALUMNOS',
            'Descripción Asunto': c.descripcion_asunto || '',
            'Tiene Anexo PDF': c.anexo_path ? 'SÍ' : 'NO',
            'Archivo Anexo': c.anexo_path ? path.basename(c.anexo_path) : '',
            'Usuario OnBase': c.onbase_target_user || '',
            'Radicado OnBase': c.radicado || '',
            'NIS OnBase': c.nis || '',
            'Fecha Radicado OnBase': c.fecha_radicado || '',
            'Vinculado Historia Académica': c.historia_doc_id ? `SÍ (Doc #${c.historia_doc_id})` : 'NO',
            'Fecha Registro': c.created_at ? new Date(c.created_at).toLocaleString('es-CO') : '',
            'Fecha Envío OnBase': c.enviado_at ? new Date(c.enviado_at).toLocaleString('es-CO') : '',
            'Detalle Error': c.error_message || ''
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Mensaje': 'Sin registros para el filtro seleccionado' }]);
        xlsx.utils.book_append_sheet(wb, ws, 'Evidencia_Deserciones');

        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const stamp = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Disposition', `attachment; filename="Acta_Evidencia_Deserciones_${stamp}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
    } catch (err) {
        console.error('[DESERCIONES] Error exportando reporte Excel:', err);
        return res.status(500).json({ error: `Error generando reporte Excel: ${err.message}` });
    }
});

// 6.2 Vincular resoluciones/citaciones notificadas al Expediente de Historia Académica (68.9224.4-37) para Cargue AES
router.post('/vincular-historias', requireAuth, async (req, res) => {
    const { caso_ids } = req.body || {};
    try {
        await ensureDesercionesTable();

        let casosRes;
        if (Array.isArray(caso_ids) && caso_ids.length > 0) {
            const cleanIds = caso_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
            casosRes = await pool.query('SELECT * FROM deserciones_casos WHERE id = ANY($1::int[]) ORDER BY id ASC', [cleanIds]);
        } else {
            casosRes = await pool.query("SELECT * FROM deserciones_casos WHERE status = 'Cargado' AND historia_doc_id IS NULL ORDER BY id ASC");
        }

        const casos = casosRes.rows || [];
        if (casos.length === 0) {
            return res.json({
                success: true,
                message: 'No hay casos pendientes por vincular a Historias Académicas.',
                vinculados: 0,
                ya_vinculados: 0,
                sin_expediente: 0,
                sin_pdf: 0
            });
        }

        // Resolver serie TRD 68.9224.4-37 (Historias Académicas)
        const serRes = await pool.query(
            "SELECT id, dependency_id FROM trd_series WHERE series_code LIKE '%9224.4-37%' OR id = 97 ORDER BY id ASC LIMIT 1"
        );
        const seriesId = serRes.rows?.[0]?.id || 97;
        const defaultOrgId = serRes.rows?.[0]?.dependency_id || 8;

        let vinculados = 0;
        let yaVinculados = 0;
        let sinExpediente = 0;
        let sinPdf = 0;

        for (const caso of casos) {
            if (caso.historia_doc_id) {
                yaVinculados++;
                continue;
            }

            const docNum = String(caso.aprendiz_doc_numero || '').trim();
            if (!docNum) {
                sinExpediente++;
                continue;
            }

            const rawPdfPath = (caso.anexo_path && String(caso.anexo_path).trim()) || (caso.comunicacion_pdf_path && String(caso.comunicacion_pdf_path).trim()) || '';
            if (!rawPdfPath) {
                sinPdf++;
                continue;
            }

            // Buscar expediente de Historia Académica (68.9224.4-37) del aprendiz por número de documento
            const expRes = await pool.query(
                `SELECT id, expediente_code, title, organization_id
                 FROM expedientes
                 WHERE (subserie LIKE '%9224.4-37%' OR subserie LIKE '%-37' OR subserie = '37')
                   AND (
                       COALESCE(title, '') ILIKE '%' || $1 || '%'
                       OR COALESCE(metadata_values::text, '') ILIKE '%' || $1 || '%'
                       OR COALESCE(expediente_code, '') ILIKE '%' || $1 || '%'
                   )
                 ORDER BY id DESC
                 LIMIT 1`,
                [docNum]
            );

            if (!expRes.rows || expRes.rows.length === 0) {
                sinExpediente++;
                continue;
            }

            const exp = expRes.rows[0];
            const typologyName = caso.etapa === 'CITACION_COMITE'
                ? 'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO'
                : 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PLAN DE MEJORAMIENTO ACADEMICO O DISCIPLINARIO';

            // Verificar si ya existe ese mismo archivo en el expediente
            const dupDoc = await pool.query(
                'SELECT id FROM documents WHERE expediente_id = $1 AND path = $2 LIMIT 1',
                [exp.id, rawPdfPath]
            );

            let docId;
            if (dupDoc.rows && dupDoc.rows.length > 0) {
                docId = dupDoc.rows[0].id;
                yaVinculados++;
            } else {
                const fileName = path.basename(rawPdfPath);
                const docDate = (caso.enviado_at || caso.created_at || new Date()).toISOString().slice(0, 10);
                const metaObj = {
                    description: caso.descripcion_asunto || typologyName,
                    aprendiz_doc_numero: docNum,
                    aprendiz_nombre: caso.aprendiz_nombre || '',
                    ficha: caso.ficha || '',
                    resolucion: caso.resolucion || '',
                    radicado_desercion: caso.radicado || ''
                };

                const insDoc = await pool.query(
                    `INSERT INTO documents (
                        organization_id, trd_series_id, trd_subseries_id, expediente_id,
                        filename, path, typology_name, document_date, status, origen, metadata_values, user_id
                    ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'Pendiente', 'Electrónico', $8, $9)
                    RETURNING id`,
                    [
                        exp.organization_id || defaultOrgId,
                        seriesId,
                        exp.id,
                        fileName,
                        rawPdfPath,
                        typologyName,
                        docDate,
                        JSON.stringify(metaObj),
                        req.user?.id || null
                    ]
                );
                docId = insDoc.rows[0].id;
                vinculados++;
            }

            await pool.query(
                'UPDATE deserciones_casos SET historia_doc_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [caso.id, docId]
            );
        }

        return res.json({
            success: true,
            message: `Vinculación con Historias Académicas finalizada: ${vinculados} documento(s) nuevo(s) indexados para Cargue AES (${yaVinculados} ya vinculados, ${sinExpediente} sin expediente creado aún, ${sinPdf} sin PDF).`,
            vinculados,
            ya_vinculados: yaVinculados,
            sin_expediente: sinExpediente,
            sin_pdf: sinPdf
        });
    } catch (err) {
        console.error('[DESERCIONES] Error vinculando con Historias Académicas:', err);
        return res.status(500).json({ error: `Error al vincular con Historias Académicas: ${err.message}` });
    }
});

// 7. Limpiar/vaciar histórico de casos de prueba
router.post('/limpiar-casos', requireAuth, async (req, res) => {
    try {
        await ensureDesercionesTable();
        await pool.query('TRUNCATE TABLE deserciones_casos RESTART IDENTITY;');
        res.json({ message: 'El histórico de casos de prueba se ha limpiado correctamente.' });
    } catch (err) {
        console.error('[DESERCIONES] Error limpiando casos:', err);
        res.status(500).json({ error: 'Error al vaciar el histórico de casos.' });
    }
});

// 8. Marcar casos seleccionados o todos como 'Cargado'
router.post('/marcar-cargado', requireAuth, async (req, res) => {
    const { caso_ids } = req.body;
    try {
        await ensureDesercionesTable();
        if (caso_ids && Array.isArray(caso_ids) && caso_ids.length > 0) {
            const placeholders = caso_ids.map((_, i) => `$${i + 1}`).join(',');
            await pool.query(
                `UPDATE deserciones_casos SET status = 'Cargado', updated_at = NOW() WHERE id IN (${placeholders})`,
                caso_ids
            );
            res.json({ success: true, message: `${caso_ids.length} caso(s) marcados como Cargados exitosamente.` });
        } else {
            const result = await pool.query(
                "UPDATE deserciones_casos SET status = 'Cargado', updated_at = NOW() WHERE status = 'Pendiente' RETURNING id"
            );
            res.json({ success: true, message: `Todos los casos pendientes (${result.rowCount}) fueron marcados como Cargados exitosamente.` });
        }
    } catch (err) {
        console.error('[DESERCIONES] Error marcando casos como cargados:', err);
        res.status(500).json({ error: `Error al actualizar estado de los casos: ${err.message}` });
    }
});

// 9. Eliminar casos seleccionados
router.post('/eliminar-casos', requireAuth, async (req, res) => {
    const { caso_ids } = req.body;
    if (!caso_ids || !Array.isArray(caso_ids) || caso_ids.length === 0) {
        return res.status(400).json({ error: 'Debe especificar al menos un ID de caso para eliminar.' });
    }
    try {
        await ensureDesercionesTable();
        const placeholders = caso_ids.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(`DELETE FROM deserciones_casos WHERE id IN (${placeholders})`, caso_ids);
        res.json({ success: true, message: `${caso_ids.length} caso(s) eliminados exitosamente.` });
    } catch (err) {
        console.error('[DESERCIONES] Error eliminando casos:', err);
        res.status(500).json({ error: `Error al eliminar los casos seleccionados: ${err.message}` });
    }
});

// 10. Actualizar Acudiente (Nombre y Correo de copia independiente) y/o Tipo Doc (TI/CC) en un caso existente
router.put('/casos/:id/acudiente', requireAuth, async (req, res) => {
    const casoId = parseInt(req.params.id, 10);
    if (!casoId || isNaN(casoId)) {
        return res.status(400).json({ error: 'ID de caso inválido.' });
    }
    const { acudiente_nombre = '', acudiente_correo = '', aprendiz_doc_tipo } = req.body || {};
    try {
        await ensureDesercionesTable();
        const existingRes = await pool.query('SELECT * FROM deserciones_casos WHERE id = $1 LIMIT 1', [casoId]);
        if (!existingRes.rows || existingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Caso no encontrado.' });
        }
        const caso = existingRes.rows[0];
        const cleanAcNombre = String(acudiente_nombre || '').trim();
        const cleanAcCorreo = String(acudiente_correo || '').trim();
        const newDocTipo = aprendiz_doc_tipo ? String(aprendiz_doc_tipo).trim().toUpperCase() : (caso.aprendiz_doc_tipo || 'CC');

        // Reconstruir lista de copias CC conservando los institucionales y actualizando el acudiente propio de este caso
        let currentCc = [];
        if (caso.copy_emails) {
            try {
                currentCc = typeof caso.copy_emails === 'string' ? JSON.parse(caso.copy_emails) : caso.copy_emails;
            } catch (e) {}
        }
        if (!Array.isArray(currentCc) || currentCc.length === 0) {
            currentCc = [...DEFAULT_CIMI_CC_EMAILS];
        }
        // Quitar acudiente anterior de la lista CC de este caso
        const institutionalCc = currentCc.filter(c => c && !c.is_acudiente);
        const updatedCc = [...institutionalCc];

        if (cleanAcCorreo && cleanAcCorreo.includes('@')) {
            const parts = cleanAcCorreo.split(/[;,]+/).map(s => s.trim()).filter(s => s.includes('@'));
            const labelAc = cleanAcNombre || `Acudiente de ${caso.aprendiz_nombre || 'Aprendiz'}`;
            for (let i = parts.length - 1; i >= 0; i--) {
                const em = parts[i];
                if (!updatedCc.some(c => String(c.email || '').toLowerCase() === em.toLowerCase())) {
                    updatedCc.unshift({
                        name: labelAc,
                        email: em,
                        is_acudiente: true
                    });
                }
            }
        }

        const rawRow = (caso.raw_row && typeof caso.raw_row === 'object') ? { ...caso.raw_row } : {};
        rawRow['NOMBRE ACUDIENTE'] = cleanAcNombre;
        rawRow['CORREO ACUDIENTE'] = cleanAcCorreo;
        rawRow['TIPO'] = newDocTipo;

        // Si el caso pasó a TI (Menor de Edad) o tiene plantilla inicial, re-combinar texto con los datos del acudiente
        let tplToUse = caso.texto_inicial || '';
        let descToUse = caso.descripcion_asunto || '';
        if (newDocTipo === 'TI' && (!tplToUse.includes('Menor de Edad') && !tplToUse.includes('Representante Legal'))) {
            let savedTpls = DEFAULT_DESERCIONES_TEMPLATES;
            try {
                const tplDbRes = await pool.query("SELECT value FROM system_settings WHERE key = 'sena_deserciones_templates_v2'");
                if (tplDbRes.rows?.[0]?.value) {
                    savedTpls = { ...DEFAULT_DESERCIONES_TEMPLATES, ...JSON.parse(tplDbRes.rows[0].value) };
                }
            } catch (_) {}

            tplToUse = caso.etapa === 'CITACION_COMITE'
                ? savedTpls.citacion_menor_ti
                : caso.etapa === 'NOTIFICACION_APRENDIZ'
                    ? (savedTpls.notificacion_aprendiz_menor_ti || savedTpls.notificacion_aprendiz_mayor)
                    : savedTpls.resolucion_menor_ti;
            descToUse = mergeText(
                caso.etapa === 'CITACION_COMITE'
                    ? savedTpls.descripcion_asunto_citacion_ti
                    : caso.etapa === 'NOTIFICACION_APRENDIZ'
                        ? savedTpls.descripcion_asunto_notificacion_aprendiz_ti
                        : savedTpls.descripcion_asunto_resolucion_ti,
                { ...caso, aprendiz_doc_tipo: newDocTipo, acudiente_nombre: cleanAcNombre, acudiente_correo: cleanAcCorreo, raw_row: rawRow }
            );
        }
        const remergedText = tplToUse
            ? mergeText(tplToUse, { ...caso, aprendiz_doc_tipo: newDocTipo, acudiente_nombre: cleanAcNombre, acudiente_correo: cleanAcCorreo, raw_row: rawRow })
            : caso.texto_combinado;

        const updRes = await pool.query(`
            UPDATE deserciones_casos
            SET acudiente_nombre = $2,
                acudiente_correo = $3,
                aprendiz_doc_tipo = $4,
                copy_emails = $5,
                raw_row = $6::jsonb,
                texto_inicial = $7,
                texto_combinado = $8,
                descripcion_asunto = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [
            casoId,
            cleanAcNombre,
            cleanAcCorreo,
            newDocTipo,
            JSON.stringify(updatedCc),
            JSON.stringify(rawRow),
            tplToUse,
            remergedText,
            descToUse
        ]);

        return res.json({
            success: true,
            message: cleanAcCorreo
                ? `✅ Acudiente (${cleanAcNombre || 'Representante Legal'} — ${cleanAcCorreo}) asignado en copia independiente para el aprendiz ${caso.aprendiz_nombre}.`
                : `Datos de acudiente actualizados para ${caso.aprendiz_nombre}.`,
            caso: updRes.rows[0]
        });
    } catch (err) {
        console.error('[DESERCIONES] Error actualizando acudiente:', err);
        return res.status(500).json({ error: `Error al actualizar datos del acudiente: ${err.message}` });
    }
});

module.exports = router;
