require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציה אטומית - בלי פילטרים, בלי סיבוכים
async function askGemini(prompt) {
    // שים לב: השתמשתי ב-v1 במקום v1beta, זה יותר יציב ב-Render
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();

    if (data.error) {
        console.error("❌ שגיאת גוגל ישירה:", data.error.message);
        throw new Error(data.error.message);
    }

    if (!data.candidates || !data.candidates[0]) {
        console.error("❌ גוגל החזיר תשובה ריקה:", JSON.stringify(data));
        throw new Error("Empty Response");
    }

    return data.candidates[0].content.parts[0].text;
}

// נתיב המפרטים
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מנסה לשלוף עבור: ${brand} ${model} ${year}`);

    try {
        const prompt = `Give me a JSON of engine options and trims for ${year} ${brand} ${model} in Israel. Return ONLY: {"engines": [], "trims": []}`;
        const result = await askGemini(prompt);
        
        // חילוץ ה-JSON מהטקסט
        const match = result.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON in response");
        
        res.json({ success: true, data: JSON.parse(match[0]) });
    } catch (e) {
        console.error("⚠️ כשל במפרט:", e.message);
        // מחזיר רשימה ידנית כדי שהמשתמש לא יתקע
        res.json({ 
            success: true, 
            data: { engines: ["1.6L", "2.0L", "Hybrid"], trims: ["Standard", "Luxury"] } 
        });
    }
});

// נתיב הניתוח
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        const prompt = `Analyze car faults for ${brand} ${model} ${year}. Faults: ${faults?.join(',')}. Return JSON with reliability_score, summary, common_faults, negotiation_tip.`;
        
        const result = await askGemini(prompt);
        const match = result.match(/\{[\s\S]*\}/);
        res.json({ success: true, aiAnalysis: JSON.parse(match[0]) });
    } catch (e) {
        console.error("⚠️ כשל בניתוח:", e.message);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
