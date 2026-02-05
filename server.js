require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

async function askGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
}

app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const prompt = `Return ONLY a JSON for ${year} ${brand} ${model} in Israel: {"engines": ["1.6L Petrol", "Hybrid"], "trims": ["Style", "Luxury"]}`;
        const result = await askGemini(prompt);
        const match = result.match(/\{[\s\S]*\}/);
        res.json({ success: true, data: JSON.parse(match[0]) });
    } catch (e) {
        res.json({ success: true, data: { engines: ["1.6L", "Hybrid"], trims: ["Base"] } });
    }
});

app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        const prompt = `Analyze car: ${brand} ${model} ${year} ${engine} ${trim}. Faults: ${faults}. Return JSON: {"reliability_score": 85, "summary": "סיכום בעברית", "common_faults": ["תקלה 1"], "negotiation_tip": "טיפ"}`;
        const result = await askGemini(prompt);
        const match = result.match(/\{[\s\S]*\}/);
        res.json({ success: true, aiAnalysis: JSON.parse(match[0]) });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 10000);
