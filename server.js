require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
// שימוש בספרייה הרשמית של גוגל - הכי בטוח
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// אתחול המנוע
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// פונקציית עזר לניקוי JSON
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        return null;
    }
}

// נתיב 1: מפרטים (Spec Lookup)
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מחפש מפרט: ${brand} ${model} ${year}`);

    try {
        if (!API_KEY) throw new Error("חסר מפתח API בשרת");

        const prompt = `
        List ONLY the engine options (volume + type) and trim levels for a ${year} ${brand} ${model} sold in Israel.
        Return valid JSON only: {"engines": ["..."], "trims": ["..."]}
        Do not include explanations.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const specs = extractJSON(text);
        if (!specs) throw new Error("JSON לא תקין");

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ שגיאה במפרט:", error.message);
        // Fallback למקרה של תקלה
        res.json({ 
            success: true, 
            data: { engines: ["בנזין", "היברידי", "טורבו"], trims: ["דגם בסיס", "דגם מפואר"] },
            is_fallback: true
        });
    }
});

// נתיב 2: ניתוח (Analysis)
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        console.log(`🤖 מנתח רכב...`);

        const prompt = `
        פעל כשמאי רכב. רכב: ${brand} ${model} שנת ${year} (${engine}), גימור: ${trim}.
        תקלות: ${faults && faults.length ? faults.join(',') : "ללא"}.
        החזר JSON: {"reliability_score": 85, "summary": "...", "common_faults": ["..."], "negotiation_tip": "..."}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonResult = extractJSON(text);

        res.json({ success: true, aiAnalysis: jsonResult });

    } catch (error) {
        console.error("❌ שגיאה בניתוח:", error.message);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
