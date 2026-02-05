require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציה אטומית לשליחה לגוגל (Node 18 Native Fetch)
async function askGemini(prompt) {
    if (!API_KEY) throw new Error("API Key missing on server");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || !data.candidates[0]) throw new Error("Empty Response from AI");

    return data.candidates[0].content.parts[0].text;
}

// ניקוי JSON שמגיע מה-AI
function cleanJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
}

// === נתיב 1: מפרטים (הלב של המערכת) ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 Seeking specs for: ${year} ${brand} ${model}`);

    try {
        // פרומפט מדויק לשוק הישראלי
        const prompt = `
        Act as an Israeli car database.
        List EXACT engine options (volume + type + hp) and trim levels sold in Israel for: ${year} ${brand} ${model}.
        Return ONLY valid JSON: 
        {
            "engines": ["1.6L Petrol (132hp)", "1.8L Hybrid"],
            "trims": ["Sun", "Style", "Premium"]
        }
        Do not explain.
        `;

        const rawText = await askGemini(prompt);
        const specs = cleanJSON(rawText);

        if (!specs) throw new Error("Failed to parse JSON");

        res.json({ success: true, data: specs });

    } catch (e) {
        console.error("⚠️ Spec Error:", e.message);
        // Fallback: רשת ביטחון כדי שהאפליקציה תמיד תעבוד
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "היברידי", "טורבו-דיזל", "חשמלי"], 
                trims: ["דגם בסיס", "דגם מאובזר", "דגם מפואר"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח המוסכניק ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `
        Role: Israeli Mechanic Expert.
        Car: ${brand} ${model} ${year}, ${engine}, ${trim}.
        Faults: ${faults && faults.length ? faults.join(',') : "None"}.
        Task: Provide a buying advice analysis in Hebrew.
        Return JSON:
        {
            "reliability_score": 85,
            "summary": "Short Hebrew summary (2 sentences)",
            "common_faults": ["Fault 1 (Price NIS)", "Fault 2"],
            "negotiation_tip": "One sharp tip"
        }
        `;

        const rawText = await askGemini(prompt);
        const analysis = cleanJSON(rawText);

        if (!analysis) throw new Error("AI Analysis Failed");

        res.json({ success: true, aiAnalysis: analysis });

    } catch (e) {
        console.error("Analysis Error:", e.message);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
