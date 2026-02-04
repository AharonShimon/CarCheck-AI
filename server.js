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

// בדיקת מפתח בעלייה
if (!API_KEY) console.error("❌ CRITICAL: Missing API Key in .env");
else console.log("✅ Server started. API Key loaded.");

// === פונקציית קסם לניקוי תשובות AI ===
function cleanAndParseJSON(text) {
    try {
        // מנסה למצוא מערך [...] או אובייקט {...}
        const startArray = text.indexOf('[');
        const endArray = text.lastIndexOf(']');
        const startObj = text.indexOf('{');
        const endObj = text.lastIndexOf('}');

        let clean = text;

        // אם זה מערך
        if (startArray !== -1 && endArray !== -1) {
            clean = text.substring(startArray, endArray + 1);
        } 
        // אם זה אובייקט (לניתוח הסופי)
        else if (startObj !== -1 && endObj !== -1) {
            clean = text.substring(startObj, endObj + 1);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.error("⚠️ JSON Parse Error on text:", text);
        return null;
    }
}

// === נתיב 1: שליפת תתי-דגם (AI) ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { brand, model } = req.body;
        console.log(`📋 AI מחפש תתי-דגם עבור: ${brand} ${model}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        // הנחיה חריפה ל-AI לתת רשימה מקיפה
        const prompt = `Task: List ALL trim levels and engine variants for "${brand} ${model}" sold in Israel.
        Format: Return ONLY a raw JSON array of strings. No Markdown, no intro text.
        Example: ["1.6 Sun", "1.8 Hybrid", "1.2 Turbo", "1.5 Inspire"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0 }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        console.log("🔹 AI Raw Answer:", rawText);

        const options = cleanAndParseJSON(rawText) || [];
        
        console.log("✅ Sending to client:", options);
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("❌ Error fetching submodels:", error.message);
        res.json({ success: false, options: [] }); // לא מפיל את הלקוח
    }
});

// === נתיב 2: ניתוח מלא ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
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

        res.json({ success: true, aiAnalysis: analysis });

    } catch (error) {
        console.error("❌ Analysis Error:", error.message);
        res.status(500).json({ error: "AI Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
