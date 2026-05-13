const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const multer = require('multer');
const { requireAuth } = require('../middleware/authMiddleware');
const db = require('../database');

// Configuración de multer (memoria para no guardar el PDF en disco temporalmente, o disco si es muy grande)
const upload = multer({ storage: multer.memoryStorage() });

// ──────────────────────────────────────────────────────────────
// INICIALIZACIÓN DE GEMINI
// ──────────────────────────────────────────────────────────────
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// ──────────────────────────────────────────────────────────────
// 1. ASISTENTE CHATBOT (POST /api/ai/chat)
// ──────────────────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
    try {
        if (!genAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada en el servidor (.env).' });
        }

        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'El mensaje es requerido.' });

        const model = genAI.getGenerativeModel({ 
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
        if (!genAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });
        }
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'El archivo debe ser un PDF.' });
        }

        // Extraer texto del PDF usando pdf-parse (máximo 3 páginas para ahorrar tokens y tiempo)
        const pdfData = await pdfParse(req.file.buffer, { max: 3 });
        const extractedText = pdfData.text.substring(0, 15000); // Limitar a aprox 15k caracteres

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({ error: 'El PDF parece estar escaneado como imagen o no tiene texto extraíble.' });
        }

        // Obtener tipologías válidas de la base de datos para darle opciones a la IA
        const tipologiasResult = await db.pool.query('SELECT DISTINCT typology_name FROM trd_typologies WHERE typology_name IS NOT NULL');
        const tipologias = tipologiasResult.rows.map(r => r.typology_name).join(', ');

        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

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
3. No incluyas markdown como \`\`\`json, solo el JSON raw.
`;

        const result = await model.generateContent(prompt);
        let textResponse = result.response.text().trim();
        
        // Limpiar el markdown de bloques de código si la IA lo incluyó por error
        if (textResponse.startsWith('```json')) textResponse = textResponse.replace(/```json/g, '');
        if (textResponse.startsWith('```')) textResponse = textResponse.replace(/```/g, '');
        textResponse = textResponse.trim();

        const jsonResponse = JSON.parse(textResponse);
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
        if (!genAI) {
            return res.status(503).json({ error: 'La API Key de Gemini no está configurada.' });
        }

        const expedienteId = req.params.id;
        if (!expedienteId) {
            return res.status(400).json({ error: 'Falta el ID del expediente.' });
        }

        // Obtener la información principal del expediente
        const expResult = await db.pool.query('SELECT expediente_name, user_owner_id, date_created FROM expedientes WHERE id = $1', [expedienteId]);
        if (expResult.rows.length === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado.' });
        }
        const expediente = expResult.rows[0];

        // Obtener la lista de archivos asociados a este expediente (solo metadatos, sin descargar el PDF)
        const filesResult = await db.pool.query(`
            SELECT f.original_name, t.typology_name
            FROM expediente_files f
            LEFT JOIN trd_typologies t ON f.typology_id = t.id
            WHERE f.expediente_id = $1
        `, [expedienteId]);
        
        const files = filesResult.rows;
        
        if (files.length === 0) {
            return res.json({ summary: 'Este expediente se encuentra vacío. No contiene ningún documento para analizar.' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const prompt = `
Eres un asistente analista de archivos.
Genera un breve resumen en UN SÓLO PÁRRAFO sobre el contenido general del siguiente Expediente Electrónico, basándote en su nombre y los documentos que contiene. 
No hagas listas largas ni bullets, solo redacta un párrafo profesional y fácil de leer.

DATOS DEL EXPEDIENTE:
- Nombre: ${expediente.expediente_name}
- Fecha de Creación: ${expediente.date_created}
- Total Documentos: ${files.length}

DOCUMENTOS CONTENIDOS:
${files.map((f, i) => `${i+1}. ${f.original_name} (Tipología: ${f.typology_name || 'No especificada'})`).join('\n')}
`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();

        res.json({ summary });

    } catch (error) {
        console.error('[AI SUMMARIZE ERROR]', error);
        res.status(500).json({ error: 'Error al generar el resumen del expediente: ' + error.message });
    }
});

module.exports = router;
