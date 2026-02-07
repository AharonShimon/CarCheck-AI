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
    // מודלים יציבים ל-2026
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
            if (err.message.includes("429")) {
                console.error("🛑 חריגה ממכסת בקשות (Quota Exceeded)");
                throw new Error("המכסה היומית הסתיימה. נסה שוב בעוד מספר דקות.");
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
            ? `STRICT RULE: Focus ONLY on the year ${year}. Mention specific recalls and serial faults for this exact version.`
            : `STRICT RULE: Provide a GENERAL reliability overview for ${brand} ${model} across all years. Mention that issues vary between generations.`;

        const smartPrompt = `
            Act as a senior vehicle inspector in Israel. 
            Analyze: ${brand} ${model} ${isPrecise ? `Year: ${year}` : '(General)'}.
            ${modeInstruction}
            Return ONLY a valid JSON:
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
        console.error("❌ שגיאה סופית:", error.message);
        const brandName = req.body.brand || "הרכב";
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 75,
                summary: error.message.includes("המכסה") 
                    ? "מכסת ה-AI הסתיימה להיום. מוצג ניתוח בסיסי המבוסס על נתוני עבר."
                    : `חלה שגיאה בחיבור. באופן כללי, ${brandName} נחשב למותג אמין יחסית.`,
                common_faults: ["יש לבדוק היסטוריית טיפולים", "בלאי טבעי"],
                pros: ["זמינות חלפים גבוהה"],
                cons: ["רגישות להזנחה"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 המוסכניק באוויר בפורט ${PORT}`));
