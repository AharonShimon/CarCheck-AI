require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === פונקציית עזר: חילוץ JSON נקי (מונע קריסות) ===
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        const cleanText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return null;
    }
}

// === נתיב 1: שליפת מפרטים (הפרומפט המדויק לישראל) ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מחפש מפרט מדויק: ${brand} ${model} ${year}`);

    try {
        if (!API_KEY) throw new Error("חסר מפתח API");

        // הפרומפט הכירורגי - מכריח את ה-AI לדייק בשוק הישראלי
        const promptText = `
        You are an expert Israeli car database.
        List ONLY the specific engine options (volume + type) and trim levels (רמות גימור) 
        that were officially sold in Israel for the following car:
        
        Manufacturer: ${brand}
        Model: ${model}
        Year: ${year}
        
        Rules:
        1. Focus ONLY on the Israeli market (IL).
        2. Engines must include volume (e.g., "2.0L SkyActiv", "1.6L Turbo", "1.2L TSI").
        3. Trims must be in English or Hebrew transliteration (e.g., "Executive", "Premium", "Spirit", "Instyle").
        4. Do NOT invent trims.
        5. Return valid JSON only: {"engines": ["..."], "trims": ["..."]}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();

        if (!data.candidates || !data.candidates[0]) {
            throw new Error("גוגל לא החזיר תשובה");
        }

        const aiText = data.candidates[0].content.parts[0].text;
        const specs = extractJSON(aiText);

        if (!specs) throw new Error("JSON לא תקין");

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("⚠️ שגיאה במפרט:", error.message);
        // גיבוי למקרה של תקלה כדי שהמשתמש לא ייתקע
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "טורבו", "היברידי", "דיזל", "חשמלי"], 
                trims: ["רמת גימור בסיסית", "רמת גימור גבוהה", "אחר"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח הרכב (מוסכניק) ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `
        פעל כשמאי רכב ומוסכניק ישראלי.
        רכב: ${brand} ${model} שנת ${year} (${engine}), גימור: ${trim}.
        תקלות שדווחו: ${faults && faults.length ? faults.join(',') : "רכב נקי"}.
        
        החזר JSON בלבד:
        {
            "reliability_score": מספר (1-100),
            "summary": "סיכום קצר וחד בעברית",
            "common_faults": ["תקלה 1 (X שח)", "תקלה 2 (Y שח)"],
            "negotiation_tip": "טיפ למומ"
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) throw new Error("No AI response");
        
        const result = extractJSON(data.candidates[0].content.parts[0].text);
        if (!result) throw new Error("Invalid JSON from Analysis");

        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
