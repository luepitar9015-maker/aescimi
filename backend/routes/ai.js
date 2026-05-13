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

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Prompt de contexto (System Prompt simulado)
        const systemInstruction = `
Eres un asistente experto en Gestión Documental y archivo, trabajando para un sistema llamado "SENA V2 / Enfoque Rosa". 
Tu objetivo es ayudar a los usuarios del sistema a entender cómo clasificar documentos, cómo usar los módulos (Creación Masiva, Seguimiento, Inventario) y responder preguntas sobre Tablas de Retención Documental (TRD).
Responde siempre de forma amable, profesional, muy concisa y al grano. Usa formato Markdown para que sea fácil de leer.
Nunca inventes códigos de TRD si no estás seguro, sugiere consultar el manual del sistema.
`;

        // Preparar el historial en el formato de Gemini
        const formattedHistory = [];
        if (history && Array.isArray(history)) {
            for (const msg of history) {
                formattedHistory.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: systemInstruction }] },
                { role: 'model', parts: [{ text: 'Entendido. Estoy listo para ayudar con la gestión documental.' }] },
                ...formattedHistory
            ]
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error('[AI CHAT ERROR]', error);
        res.status(500).json({ error: 'Error al procesar la solicitud con la IA.' });
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

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

module.exports = router;
