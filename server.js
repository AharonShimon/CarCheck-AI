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

// === מערכת זיכרון (Cache) ===
// כאן נשמור את כל הרשימות שה-AI כבר הביא, כדי לא לשאול שוב
const optionsCache = {}; 

// === פונקציות עזר ===
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
        return null;
    }
}

// === נתיב 1: שליפת תתי-דגם (עם זיכרון!) ===
app.post('/get-car-options', async (req, res) => {
    const { brand, model } = req.body;
    const cacheKey = `${brand}-${model}`; // מפתח ייחודי, למשל: "סיטרואן-ברלינגו"

    // 1. בדיקה האם זה כבר בזיכרון?
    if (optionsCache[cacheKey]) {
        console.log(`⚡ שליפה מהיר מהזיכרון עבור: ${brand} ${model}`);
        return res.json({ success: true, options: optionsCache[cacheKey] });
    }

    // 2. אם לא בזיכרון - שולחים בקשה ל-AI
    try {
        console.log(`🤖 שולח בקשה ל-AI עבור: ${brand} ${model}`);

        // שימוש ב-1.5 Flash לרשימות (יותר מכסות בחינם, יותר מהיר)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `List all trim levels and engine variants for "${brand} ${model}" sold in Israel. Return ONLY a raw JSON array of strings. Example: ["1.6 Sun", "1.8 Hybrid", "1.2 Turbo"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = cleanAndParseArray(rawText);

        // 3. שמירה בזיכרון לפעם הבאה!
        if (options.length > 0) {
            optionsCache[cacheKey] = options;
        }
        
        res.json({ success: true, options: options });

    } catch (error) {
        // טיפול ספציפי בשגיאת 429
        if (error.response && error.response.status === 429) {
            console.error("⏳ נגמרה המכסה (429). אנא המתן.");
            return res.status(429).json({ success: false, error: "Too many requests" });
        }
        console.error("❌ Error fetching options:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח מלא ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    try {
        // לניתוח נשארים עם 2.5 כי הוא חכם יותר
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
        if (error.response && error.response.status === 429) {
            console.error("⏳ 429 Too Many Requests - Analysis");
            return res.status(429).json({ error: "System busy, try in 1 min" });
        }
        console.error("❌ AI Error:", error.message);
        res.status(500).json({ error: "AI Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
