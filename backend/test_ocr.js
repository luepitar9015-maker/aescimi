require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testOCR() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    
    // 1x1 white pixel jpeg image base64
    const base64Data = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const mimeType = 'image/jpeg';
    
    console.log("Sending test OCR request to Gemini...");
    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            },
            'Extrae y transcribe todo el texto de esta imagen.'
        ]);
        console.log("RESPONSE SUCCESS:", result.response.text());
    } catch (err) {
        console.error("RESPONSE ERROR:", err);
    }
}

testOCR();
