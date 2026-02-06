import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

// פתרון ל-__dirname בפורמט ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// פונקציית ה-"שורד" המעודכנת
async function askGemini(prompt) {
    const modelsToTry = [
        "gemini-2.5-flash", 
        "gemini-1.5-flash", 
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`📡 מנסה חיבור עם המודל: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            if (text) {
                console.log(`✅ הצלחה עם מודל: ${modelName}`);
                return text;
            }
        } catch (err) {
            console.warn(`⚠️ מודל ${modelName} נכשל: ${err.message}`);
            lastError = err.message;
        }
    }
    throw new Error(lastError);
}

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה לניתוח: ${req.body.brand} ${req.body.model} (${req.body.year})`);

    if (!API_KEY) {
        return res.status(500).json({ error: "Missing API Key" });
    }

    try {
        const { brand, model, year } = req.body;

        const smartPrompt = `
        Act as a senior vehicle inspector in Israel. 
        Analyze the reliability of: "${brand} ${model} year ${year}".
        Return ONLY valid JSON (Hebrew).`;

        const rawResponse = await askGemini(smartPrompt);
        const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(cleanJson) });

    } catch (error) {
        console.error("❌ שגיאה:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 המוסכניק רץ בפורט ${PORT}`));
