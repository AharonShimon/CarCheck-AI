require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY; 

// === בדיקת דופק בעלייה (Sanity Check) ===
// זה יגיד לנו מיד אם השרת חסום, עוד לפני שאתה לוחץ על משהו
(async () => {
    if (!API_KEY) {
        console.error("❌ Error: API Key is missing.");
        return;
    }
    console.log("✅ API Key found. Testing connection to Google...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        if (response.ok) console.log("✅ Connection Test PASSED! Gemini is answering.");
        else console.error(`❌ Connection Test FAILED: ${response.status} ${response.statusText}`);
    } catch (e) {
        console.error("❌ Connection Test ERROR:", e.message);
    }
})();

// === פונקציית עזר לניקוי תשובות ===
function extractJSON(text) {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
        const startObj = clean.indexOf('{'); const endObj = clean.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
        else if (startObj !== -1 && endObj !== -1) clean = clean.substring(startObj, endObj + 1);
        
        return JSON.parse(clean);
    } catch (e) { return null; }
}

// === נתיב 1: דגמים (שימוש ב-Fetch טהור) ===
app.post('/get-car-options', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`📋 Fetching: ${brand} ${model} (${year})`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `List trim levels for "${brand} ${model}" in year ${year} in Israel. Return ONLY JSON array.` }] }],
                generationConfig: { temperature: 0.0 }
            })
        });

        if (!response.ok) {
            // כאן נתפוס את ה-429 האמיתי אם יש
            const errText = await response.text();
            console.error(`❌ Google Error (${response.status}):`, errText);
            return res.status(response.status).json({ error: "Google Error", details: errText });
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = extractJSON(rawText) || [];
        
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("❌ Server Fetch Error:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח (שימוש ב-Fetch טהור) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    try {
        const prompt = `Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}". Output strict JSON: { "reliability_score": int, "summary": string, "common_faults": [], "pros": [], "cons": [] }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Analysis Error (${response.status}):`, errText);
            return res.status(response.status).json({ error: "AI Failed", details: errText });
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = extractJSON(rawText);

        if (!analysis || !analysis.reliability_score) throw new Error("Invalid JSON");

        res.json({ success: true, aiAnalysis: analysis });

    } catch (error) {
        console.error("❌ Server Error:", error.message);
        res.status(500).json({ error: "Internal Error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
