require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY; 

// === נתיב לשליפת דגמים/תתי-דגם בזמן אמת ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { type, brand, model } = req.body;
        
        let prompt = "";
        if (type === 'models') {
            prompt = `Return a JSON array of strings containing the 20 most popular car models for "${brand}" sold in Israel. No Markdown. Example: ["Corolla", "Yaris"]`;
        } else if (type === 'submodels') {
            prompt = `Return a JSON array of strings containing popular trim levels and engine variants for "${brand} ${model}" sold in Israel. No Markdown. Example: ["1.6 Sun", "1.8 Hybrid"]`;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0 }
        });

        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, options: JSON.parse(rawText) });

    } catch (error) {
        console.error("Error fetching options:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב לניתוח עומק ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year } = req.body;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}".
        Rules: Link faults to physical checks (Checklist items). Provide practical inspection advice in Hebrew brackets.
        Return JSON (Hebrew):
        {
            "reliability_score": (Integer), 
            "summary": (String), 
            "common_faults": ["Fault 1 (How to check)", "Fault 2 (How to check)"], 
            "pros": ["Pro 1", "Pro 2"],
            "cons": ["Con 1", "Con 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        res.status(500).json({ error: "AI Error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
