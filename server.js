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
    // רשימת מודלים מורחבת הכוללת את הדור החדש של 2026
    const modelsToTry = [
        "gemini-2.5-flash", 
        "gemini-2.0-flash", 
        "gemini-2.0-pro", 
        "gemini-1.5-flash", 
        "gemini-1.5-pro"
    ];
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
            if (err.message.includes("429")) {
                console.error(`🛑 חריגה ממכסה במודל ${modelName}`);
                // ממשיך למודל הבא ברשימה במקרה של חריגה ממכסה
            }
            console.warn(`⚠️ מודל ${modelName} נכשל: ${err.message}`);
            lastError = err.message;
        }
    }
    throw new Error(lastError || "כל המודלים נכשלו בחיבור");
}

app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, isPrecise } = req.body;
        console.log(`🚀 ניתוח ${isPrecise ? 'מדויק' : 'כללי'}: ${brand} ${model} ${year || ''}`);

        const modeInstruction = isPrecise 
            ? `STRICT RULE: Focus ONLY on the year ${year}. Mention specific recalls, serial faults, and engine reliability for THIS EXACT YEAR only.`
            : `STRICT RULE: Provide a GENERAL overview for the ${brand} ${model} across all years. Mention that reliability varies between generations.`;

        const smartPrompt = `
            Act as a senior vehicle inspector in Israel. 
            Analyze: ${brand} ${model} ${isPrecise ? `Year: ${year}` : '(All Years)'}.
            ${modeInstruction}
            Return ONLY a valid JSON object:
            {
                "reliability_score": (int 0-100),
                "summary": (string in Hebrew, max 25 words),
                "common_faults": (array of strings in Hebrew),
                "pros": (array of strings in Hebrew),
                "cons": (array of strings in Hebrew)
            }`;

        const rawResponse = await askGemini(smartPrompt);
        const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
        res.json({ success: true, aiAnalysis: JSON.parse(cleanJson) });

    } catch (error) {
        console.error("❌ שגיאת שרת:", error.message);
        const brandName = req.body.brand || "הרכב"; 
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
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 המוסכניק באוויר בפורט ${PORT}`));
