require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציה אטומית לשליחה לגוגל
async function askGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || !data.candidates[0]) throw new Error("Empty Response");

    return data.candidates[0].content.parts[0].text;
}

// נתיב המפרטים
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const prompt = `List EXACT engine options (volume+type) and trim levels for ${year} ${brand} ${model} in Israel. Return ONLY JSON: {"engines": ["1.6 Petrol (120hp)"], "trims": ["Style", "Premium"]}`;
        const result = await askGemini(prompt);
        const match = result.match(/\{[\s\S]*\}/);
        res.json({ success: true, data: JSON.parse(match[0]) });
    } catch (e) {
        console.error("Error:", e.message);
        res.json({ success: true, data: { engines: ["בנזין", "היברידי"], trims: ["סטנדרט", "מפואר"] } });
    }
});

// נתיב הניתוח
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        const prompt = `אתה מוסכניק מומחה. נתח רכב: ${brand} ${model} ${year} ${engine} ${trim}. תקלות: ${faults}. החזר JSON עם reliability_score, summary, common_faults, negotiation_tip.`;
        const result = await askGemini(prompt);
        const match = result.match(/\{[\s\S]*\}/);
        res.json({ success: true, aiAnalysis: JSON.parse(match[0]) });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
