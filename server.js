import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

async function askGemini(prompt) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`📡 מנסה חיבור עם המודל: ${modelName}...`);
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.7 
                }
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (err) {
            console.warn(`⚠️ מודל ${modelName} נכשל.`);
            lastError = err.message;
        }
    }
    throw new Error(lastError);
}

app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, isPrecise } = req.body;
        console.log(`🚀 ניתוח ${isPrecise ? 'מדויק' : 'כללי'}: ${brand} ${model} ${year || ''}`);

        // Business Logic: התאמת הפרומפט לפי סוג הניתוח (מדויק או כללי)
        const modeInstruction = isPrecise 
            ? `STRICT RULE: Focus ONLY on the year ${year}. Mention specific recalls, serial faults, and engine reliability for THIS EXACT YEAR only. Do not mention other generations.`
            : `STRICT RULE: Provide a GENERAL overview for the ${brand} ${model} across all its production years. Mention that reliability varies between generations. Do not guess a specific year.`;

        const smartPrompt = `
            Act as a senior vehicle inspector and reliability expert in the Israeli car market. 
            Analyze: ${brand} ${model} ${isPrecise ? `Year: ${year}` : '(All Years)'}.
            
            ${modeInstruction}

            Return ONLY a valid JSON object:
            {
                "reliability_score": (int 0-100),
                "summary": (string in Hebrew, max 25 words. If general mode, include a disclaimer that data is across years),
                "common_faults": (array of 3-5 strings in Hebrew, focusing on serial issues),
                "pros": (array of 3 strings in Hebrew),
                "cons": (array of 3 strings in Hebrew)
            }
            
            Avoid special characters. Use natural Hebrew.`;

        const rawResponse = await askGemini(smartPrompt);
        const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
        
        console.log("✅ הדו\"ח פוענח בהצלחה");
        res.json({ success: true, aiAnalysis: JSON.parse(cleanJson) });

    } catch (error) {
    console.error("❌ שגיאת שרת:", error.message);
    const brandName = req.body.brand || "הרכב"; // חילוץ שם המותג
    res.json({ 
        success: true, 
        aiAnalysis: {
            reliability_score: 75,
            summary: `חלה שגיאה זמנית בחיבור ל-AI. באופן כללי, דגמי ${brandName} מציגים רמת אמינות סבירה בישראל.`,
            common_faults: ["יש לבדוק היסטוריית טיפולים", "בלאי מערכת בלימה"],
            pros: ["שוק חלפים נגיש"],
            cons: ["רגישות לתחזוקה לקויה"]
        }
    });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 המוסכניק באוויר בפורט ${PORT}`));

