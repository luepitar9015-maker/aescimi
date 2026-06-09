const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PDFParse } = require('pdf-parse');
const multer = require('multer');
const { requireAuth } = require('../middleware/authMiddleware');
const db = require('../database');

// Configuración de multer (memoria para no guardar el PDF en disco temporalmente, o disco si es muy grande)
const upload = multer({ storage: multer.memoryStorage() });

// Función para obtener la API Key de Gemini dinámicamente de BD o de .env
async function getGenAIInstance() {
    try {
        const pgPool = db.pool || require('../database_pg').pool;
        const result = await pgPool.query("SELECT value FROM system_settings WHERE key = 'gemini_api_key'");
        const dbKey = result.rows[0] ? result.rows[0].value : null;
        const apiKey = dbKey || process.env.GEMINI_API_KEY;
        if (apiKey && apiKey.trim().length > 0) {
            return new GoogleGenerativeAI(apiKey.trim());
        }
    } catch (e) {
        console.warn('[AI Settings] Error cargando API key de base de datos:', e.message);
    }
    
    if (process.env.GEMINI_API_KEY) {
        return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return null;
}

// ──────────────────────────────────────────────────────────────
// 1. ASISTENTE CHATBOT (POST /api/ai/chat)
// ──────────────────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
    try {
        const activeGenAI = await getGenAIInstance();
        if (!activeGenAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada en el sistema. Regístrela en la pestaña de configuración.' });
        }

        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'El mensaje es requerido.' });

        const model = activeGenAI.getGenerativeModel({ 
            model: 'gemini-flash-latest'
        });

        // Prompt de contexto
        const systemInstruction = `Eres un asistente experto exclusivo del "Automatizador de Gestión Documental" del sistema SENA V2.
Tu único objetivo es ayudar a los usuarios a entender cómo utilizar las herramientas del automatizador: Cargue Masivo por Excel, configuración de OneDrive, sincronización con AES, creación automática de lotes/paquetes y Seguimiento de Expedientes.
No debes responder preguntas generales sobre inventario documental ni otras áreas del sistema fuera del automatizador.
Responde siempre de forma amable, profesional, muy concisa y al grano. Usa formato Markdown para que sea fácil de leer.
Nunca inventes códigos ni rutas de configuración si no estás seguro.`;

        // Preparar el historial en el formato de Gemini
        const formattedHistory = [];
        if (history && Array.isArray(history)) {
            for (const msg of history) {
                // Omitir el saludo inicial del bot para que el historial comience siempre con el usuario y alterne correctamente
                if (msg.role === 'model' && msg.content.includes('¡Hola! Soy tu asistente')) {
                    continue; 
                }
                formattedHistory.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: `INSTRUCCIONES DEL SISTEMA (No responder esto, solo acatar): ${systemInstruction}` }] },
                { role: 'model', parts: [{ text: 'Entendido, actuaré como el Asistente SENA IA.' }] },
                ...formattedHistory
            ]
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error('[AI CHAT ERROR]', error);
        res.status(500).json({ error: error.message || 'Error al procesar la solicitud con la IA.' });
    }
});

// ──────────────────────────────────────────────────────────────
// 2. CLASIFICACIÓN DE DOCUMENTOS (POST /api/ai/classify-document)
// ──────────────────────────────────────────────────────────────
router.post('/classify-document', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const activeGenAI = await getGenAIInstance();
        if (!activeGenAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada. Regístrela en la pestaña de configuración.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });
        }
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'El archivo debe ser un PDF.' });
        }

        // Extraer texto del PDF usando pdf-parse (máximo 3 páginas para ahorrar tokens y tiempo)
        const parser = new PDFParse({ data: req.file.buffer });
        const pdfData = await parser.getText({ first: 1, last: 3 });
        const extractedText = (pdfData.text || '').substring(0, 15000); // Limitar a aprox 15k caracteres

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({ error: 'El PDF parece estar escaneado como imagen o no tiene texto extraíble.' });
        }

        // Obtener tipologías válidas de la base de datos para darle opciones a la IA
        // Permitir filtrar por subserie si viene en query o body para mejorar la precisión
        const subserie = req.query.subserie || req.body.subserie;
        let tipologiasList = [];

        const pgPool = db.pool || require('../database_pg').pool;

        if (subserie && subserie.trim().length > 0) {
            let decodedSub = subserie;
            try {
                decodedSub = decodeURIComponent(subserie);
            } catch (e) {
                console.warn('[AI CLASSIFY] Error decoding subserie URL param:', e.message);
            }
            
            const exact = decodedSub;
            const like = `%${decodedSub}%`;
            const endsWith = `%-${decodedSub}`;
            const endsWithDot = `%.${decodedSub}`;

            // Consultar base de datos PostgreSQL filtrando por subserie/serie
            const q = `
                SELECT DISTINCT t.typology_name 
                FROM trd_typologies t
                LEFT JOIN trd_subseries sub ON t.subseries_id = sub.id
                LEFT JOIN trd_series sr ON (sub.series_id = sr.id OR t.series_id = sr.id)
                WHERE (sub.subseries_code = $1 OR sub.subseries_code ILIKE $2 OR sub.subseries_code ILIKE $3 OR sub.subseries_name ILIKE $4
                   OR sr.series_code = $5 OR sr.series_code ILIKE $6 OR sr.series_code ILIKE $7 OR sr.series_name ILIKE $8)
                   AND t.typology_name IS NOT NULL
            `;
            try {
                const result = await pgPool.query(q, [exact, endsWith, endsWithDot, like, exact, endsWith, endsWithDot, like]);
                tipologiasList = result.rows.map(r => r.typology_name);
            } catch (dbErr) {
                console.warn('[AI CLASSIFY] Error al buscar tipologías para subserie:', dbErr.message);
            }
        }

        // Fallback a todas las tipologías si no se especificó subserie o si la consulta específica no arrojó resultados
        if (tipologiasList.length === 0) {
            try {
                const tipologiasResult = await pgPool.query('SELECT DISTINCT typology_name FROM trd_typologies WHERE typology_name IS NOT NULL');
                tipologiasList = tipologiasResult.rows.map(r => r.typology_name);
            } catch (fallbackErr) {
                console.error('[AI CLASSIFY] Fallback query error:', fallbackErr.message);
            }
        }

        const tipologias = tipologiasList.join(', ');

        const model = activeGenAI.getGenerativeModel({ 
            model: 'gemini-flash-latest',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `
Eres un experto clasificador de documentos de archivo.
A continuación, te proporciono el texto extraído de las primeras páginas de un documento PDF.
Tu tarea es analizar el contenido y sugerir a cuál de las siguientes "Tipologías Documentales" pertenece este documento.

Tipologías permitidas en el sistema:
[${tipologias || 'Acta, Resolución, Contrato, Cédula, RUT, Informe, Memorando, Circular'}]

Texto extraído del documento:
---
${extractedText.substring(0, 5000)}
---

Reglas:
1. Responde ÚNICAMENTE con un objeto JSON válido con este formato: 
{"tipologia_sugerida": "Nombre de la Tipologia", "confianza": 95, "razon": "Breve justificación de por qué elegiste esta tipología en 1 línea."}
2. Si ninguna tipología parece encajar, pon "tipologia_sugerida": "Desconocida".
3. No incluyas markdown como \`\`\`json o \`\`\`, solo el JSON raw.
`;

        const result = await model.generateContent(prompt);
        let textResponse = result.response.text().trim();
        
        // Limpieza robusta de la respuesta en caso de que contenga markdown JSON u otros caracteres
        let cleanText = textResponse;
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/i;
        const match = cleanText.match(jsonBlockRegex);
        if (match) {
            cleanText = match[1].trim();
        } else {
            const generalBlockRegex = /```\s*([\s\S]*?)\s*```/i;
            const genMatch = cleanText.match(generalBlockRegex);
            if (genMatch) {
                cleanText = genMatch[1].trim();
            } else {
                const firstBrace = cleanText.indexOf('{');
                const lastBrace = cleanText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
                }
            }
        }

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error('[AI CLASSIFY ERROR] No se pudo parsear el JSON. Respuesta original:', textResponse, 'Texto limpio:', cleanText);
            throw new Error('La respuesta de la IA no tiene el formato JSON esperado.');
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error('[AI CLASSIFY ERROR]', error);
        res.status(500).json({ error: 'Error al analizar el documento: ' + error.message });
    }
});

// ──────────────────────────────────────────────────────────────
// 3. RESUMEN AUTOMÁTICO DE EXPEDIENTES (GET /api/ai/summarize-expediente/:id)
// ──────────────────────────────────────────────────────────────
router.get('/summarize-expediente/:id', requireAuth, async (req, res) => {
    try {
        const activeGenAI = await getGenAIInstance();
        if (!activeGenAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada. Regístrela en la pestaña de configuración.' });
        }

        const expedienteId = req.params.id;
        if (!expedienteId) {
            return res.status(400).json({ error: 'Falta el ID del expediente.' });
        }

        const pgPool = db.pool || require('../database_pg').pool;

        // Obtener la información principal del expediente (con nombres correctos de columna)
        const expResult = await pgPool.query('SELECT title, created_at FROM expedientes WHERE id = $1', [expedienteId]);
        if (expResult.rows.length === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado.' });
        }
        const expediente = expResult.rows[0];

        // Obtener la lista de archivos asociados a este expediente (desde la tabla documents)
        const filesResult = await pgPool.query(`
            SELECT filename, typology_name
            FROM documents
            WHERE expediente_id = $1
        `, [expedienteId]);
        
        const files = filesResult.rows;
        
        if (files.length === 0) {
            return res.json({ summary: 'Este expediente se encuentra vacío. No contiene ningún documento para analizar.' });
        }

        const model = activeGenAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const prompt = `
Eres un asistente analista de archivos.
Genera un breve resumen en UN SÓLO PÁRRAFO sobre el contenido general del siguiente Expediente Electrónico, basándote en su nombre y los documentos que contiene. 
No hagas listas largas ni bullets, solo redacta un párrafo profesional y fácil de leer.

DATOS DEL EXPEDIENTE:
- Nombre: ${expediente.title}
- Fecha de Creación: ${expediente.created_at}
- Total Documentos: ${files.length}

DOCUMENTOS CONTENIDOS:
${files.map((f, i) => `${i+1}. ${f.filename} (Tipología: ${f.typology_name || 'No especificada'})`).join('\n')}
`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        res.json({ summary });

    } catch (error) {
        console.error('[AI SUMMARIZE ERROR]', error);
        res.status(500).json({ error: 'Error al generar el resumen del expediente: ' + error.message });
    }
});

// ──────────────────────────────────────────────────────────────
// 4. OCR DE IMAGEN / RECORTE (POST /api/ai/ocr-image)
// ──────────────────────────────────────────────────────────────
router.post('/ocr-image', requireAuth, async (req, res) => {
    try {
        const activeGenAI = await getGenAIInstance();
        if (!activeGenAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada. Regístrela en la pestaña de configuración.' });
        }
        
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen para procesar.' });
        }

        // El formato de la imagen puede ser una URI de datos (data:image/jpeg;base64,...)
        const base64Data = image.includes(',') ? image.split(',')[1] : image;
        const mimeType = image.includes(',') ? image.split(',')[0].split(':')[1].split(';')[0] : 'image/jpeg';

        const model = activeGenAI.getGenerativeModel({ 
            model: 'gemini-flash-latest'
        });

        const prompt = 'Extrae y transcribe de forma exacta todo el texto visible que aparezca en esta imagen. Devuelve ÚNICAMENTE la transcripción del texto sin explicaciones, sin comentarios introductorios, sin agregar formato adicional, y respetando los saltos de línea lógicos si los hay.';

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            },
            prompt
        ]);

        const text = result.response.text().trim();
        res.json({ text });

    } catch (error) {
        console.error('[AI OCR ERROR]', error);
        res.status(500).json({ error: 'Error al procesar el OCR de la imagen: ' + error.message });
    }
});

module.exports = router;

