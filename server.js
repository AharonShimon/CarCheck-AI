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

// === פונקציית ניקוי חכמה ===
function cleanAndParseJSON(text) {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const startObj = clean.indexOf('{');
        const endObj = clean.lastIndexOf('}');
        if (startObj !== -1 && endObj !== -1) {
            clean = clean.substring(startObj, endObj + 1);
        }
        return JSON.parse(clean);
    } catch (e) {
        console.error("⚠️ Failed to parse JSON");
        return null; 
    }
}

function cleanAndParseArray(text) {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const startArr = clean.indexOf('[');
        const endArr = clean.lastIndexOf(']');
        if (startArr !== -1 && endArr !== -1) {
            clean = clean.substring(startArr, endArr + 1);
        }
        return JSON.parse(clean);
    } catch (e) {
        return [];
    }
}

// === נתיב 1: שליפת תתי-דגם ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { brand, model } = req.body;
        console.log(`📋 AI מחפש תתי-דגם עבור: ${brand} ${model}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `List all trim levels and engine variants for "${brand} ${model}" sold in Israel. Return ONLY a raw JSON array of strings. Example: ["1.6 Sun", "1.8 Hybrid", "1.2 Turbo"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = cleanAndParseArray(rawText);
        
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח מלא ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as a strict Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}".
        Return JSON ONLY: { "reliability_score": int, "summary": string, "common_faults": [], "pros": [], "cons": [] }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });
        
        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = cleanAndParseJSON(rawText);

        if (!analysis || !analysis.reliability_score) {
            return res.json({ success: false, error: "AI Parsing Failed" });
        }

        res.json({ success: true, aiAnalysis: analysis });

    } catch (error) {
        res.status(500).json({ error: "AI Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
