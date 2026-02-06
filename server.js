require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// הגדרת המפתח
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- פונקציית ה-"שורד" לחיבור ל-AI ---
async function askGemini(prompt) {
    // רשימת מודלים לניסיון בסדר עדיפות - כולל ה-2.5 שעבד לך
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
            console.warn(`⚠️ מודל ${modelName} לא הגיב: ${err.message}`);
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

        CRITICAL INSTRUCTIONS:
        1. Consider ALL common engine variants sold in Israel for this model year.
        2. Identify "chronic diseases" specific to these engines/transmissions.
        3. Provide specific Pros (יתרונות) AND Cons (חסרונות).

        Return ONLY valid JSON in this format (Hebrew):
        {
            "reliability_score": (Integer 0-100), 
            "summary": (A harsh and honest summary in Hebrew, max 20 words), 
            "common_faults": ["תקלה 1", "תקלה 2"], 
            "pros": ["יתרון 1"],
            "cons": ["חיסרון 1"]
        }`;

        const rawResponse = await askGemini(smartPrompt);
        
        // ניקוי תגיות Markdown של JSON אם קיימות
        const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(cleanJson) });

    } catch (error) {
        console.error("❌ שגיאה סופית בשרת:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "כל המודלים נכשלו", 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 המוסכניק באוויר בפורט ${PORT}`));
