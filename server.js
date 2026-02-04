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

// בדיקת מפתח
if (!API_KEY) console.error("❌ CRITICAL: Missing API Key");
else console.log("✅ Server started. Key loaded.");

// === פונקציית ניקוי חכמה ===
function cleanAndParseJSON(text) {
    try {
        // מנקה Markdown ורווחים
        let clean = text.replace(/```json|```/g, '').trim();
        
        // מוצא את האובייקט JSON הראשון והאחרון
        const startObj = clean.indexOf('{');
        const endObj = clean.lastIndexOf('}');
        
        if (startObj !== -1 && endObj !== -1) {
            clean = clean.substring(startObj, endObj + 1);
        }
        
        return JSON.parse(clean);
    } catch (e) {
        console.error("⚠️ Failed to parse JSON:", text);
        return null; // מחזיר NULL במקרה כישלון
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

// === נתיב 1: דגמים ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { brand, model } = req.body;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `List all trim levels for "${brand} ${model}" in Israel. Return ONLY JSON array. Example: ["1.6 Sun", "1.8 Hybrid"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0 }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = cleanAndParseArray(rawText);
        
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("Error fetching options:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח (התיקון הקריטי) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}".
        Output JSON ONLY:
        {
            "reliability_score": 85, 
            "summary": "Hebrew summary here", 
            "common_faults": ["Fault 1", "Fault 2"], 
            "pros": ["Pro 1"],
            "cons": ["Con 1"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });
        
        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = cleanAndParseJSON(rawText);

        // === ההגנה מפני קריסה ===
        if (!analysis || !analysis.reliability_score) {
            console.error("❌ AI returned invalid data");
            return res.json({ success: false, error: "AI Parsing Failed" });
        }

        res.json({ success: true, aiAnalysis: analysis });

    } catch (error) {
        console.error("❌ AI Error:", error.message);
        res.status(500).json({ error: "Connection Error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
