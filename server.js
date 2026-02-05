require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(prompt) {
    // זה הצינור הישיר שעבד לנו תמיד
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
    return data.candidates[0].content.parts[0].text;
}

app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    // הפרומפט המדויק לישראל
    const prompt = `List EXACT engine options and trims for ${year} ${brand} ${model} in Israel. Return ONLY JSON: {"engines": [], "trims": []}`;
    
    try {
        const result = await callGemini(prompt);
        // ניקוי טקסט מיותר מסביב ל-JSON
        const cleanJson = result.match(/\{[\s\S]*\}/)[0];
        res.json({ success: true, data: JSON.parse(cleanJson) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year, engine, trim, faults } = req.body;
    const prompt = `אתה מוסכניק. רכב: ${brand} ${model} ${year} ${engine} ${trim}. תקלות: ${faults}. החזר JSON עם reliability_score, summary, common_faults, negotiation_tip`;
    
    try {
        const result = await callGemini(prompt);
        const cleanJson = result.match(/\{[\s\S]*\}/)[0];
        res.json({ success: true, aiAnalysis: JSON.parse(cleanJson) });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 10000);
