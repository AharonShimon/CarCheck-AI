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

// === פונקציית עזר חכמה לניקוי תשובות מה-AI ===
function extractArrayFromText(text) {
    try {
        // מחפש את הסוגר הראשון [ והאחרון ]
        const startIndex = text.indexOf('[');
        const endIndex = text.lastIndexOf(']');
        
        if (startIndex === -1 || endIndex === -1) {
            console.error("⚠️ לא נמצאו סוגריים [] בתשובת ה-AI");
            return []; 
        }

        // גוזר רק את מה שבפנים
        const cleanJson = text.substring(startIndex, endIndex + 1);
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("⚠️ שגיאת פענוח JSON:", e.message);
        console.error("הטקסט הבעייתי היה:", text);
        return [];
    }
}

// === נתיב 1: שליפת תתי-דגם ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { brand, model } = req.body;
        console.log(`📋 מבקש תתי-דגם עבור: ${brand} ${model}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `List the popular trim levels and engine variants for "${brand} ${model}" sold in Israel. Return ONLY a raw JSON array of strings. Example: ["1.6 Sun", "1.8 Hybrid", "1.2 Turbo"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        console.log("🔹 תשובת AI גולמית:", rawText); // נראה מה הגיע

        // שימוש בפונקציית הניקוי החדשה
        const options = extractArrayFromText(rawText);
        
        console.log("✅ רשימה נקייה שנשלחת ללקוח:", options);
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("❌ שגיאת שרת:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 מנתח: ${brand} ${model} (${year})`);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}". JSON format only.
        Return: { "reliability_score": int, "summary": string, "common_faults": [], "pros": [], "cons": [] }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });
        
        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        // כאן ה-AI מחזיר אובייקט {} ולא מערך [], אז ננקה בזהירות
        let cleanText = rawText.replace(/```json|```/g, '').trim();
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');
        if(start !== -1 && end !== -1) cleanText = cleanText.substring(start, end+1);

        res.json({ success: true, aiAnalysis: JSON.parse(cleanText) });

    } catch (error) {
        console.error("❌ שגיאה בניתוח:", error.message);
        res.status(500).json({ error: "AI Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
