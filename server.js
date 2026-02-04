require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// נתיב ראשי
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// קריאת המפתח
const API_KEY = process.env.GEMINI_API_KEY; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה (Gemini 2.5): ${req.body.brand} ${req.body.model} (${req.body.year})`);
    
    if (!API_KEY) {
        console.error("❌ שגיאה: חסר מפתח API");
        return res.status(500).json({ error: "Missing API Key" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // חזרנו למודל 2.5 כפי שביקשת
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as a strict, expert vehicle inspector in Israel.
        Analyze: "${brand} ${model} year ${year}".

        CRITICAL RULES:
        1. Consistency is key. Do not invent faults.
        2. Link faults to these physical checks if relevant: ["טחינה בשמן", "בועות במיכל עיבוי", "נשימת מנוע", "בוץ שמן", "רעידות", "נזילות"].
        3. Output MUST be valid JSON only.

        Return JSON Structure (Hebrew):
        {
            "reliability_score": (Integer 0-100), 
            "summary": (Short summary in Hebrew), 
            "common_faults": ["Fault 1", "Fault 2"], 
            "pros": ["Pro 1", "Pro 2"],
            "cons": ["Con 1", "Con 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            // === התיקון הקריטי לדיוק: טמפרטורה 0 ===
            generationConfig: {
                temperature: 0.0, 
                topP: 0.95,
                topK: 40
            }
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        // ניקוי יסודי של התשובה כדי למנוע שגיאות JSON
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        console.log("✅ תשובה התקבלה בהצלחה");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה ב-AI:", error.response?.data || error.message);
        res.status(500).json({ error: "AI Error", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
