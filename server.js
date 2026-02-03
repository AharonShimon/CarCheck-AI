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

// --- קריאת המפתח מהכספת של Render ---
// וודא שהגדרת ב-Render את המשתנה: GEMINI_API_KEY
const API_KEY = process.env.GEMINI_API_KEY; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה: ${req.body.brand} ${req.body.model}`);
    
    // בדיקת הגנה: אם המפתח לא הוגדר ב-Render
    if (!API_KEY) {
        console.error("❌ שגיאה קריטית: חסר מפתח API בהגדרות השרת (Environment Variables)");
        return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // שימוש במודל Gemini 2.5 Flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as a senior vehicle inspector in Israel. 
        Your task is to identify known "chronic diseases" and common failures reported by users online for the: 
        "${brand} ${model} year ${year}".

        Do NOT provide generic advice like "check tires". 
        Focus on SPECIFIC engine/transmission/electric faults known for this specific model year.

        Return ONLY valid JSON in this format (Hebrew):
        {
            "reliability_score": (Integer 0-100 based on known reliability history), 
            "summary": (A harsh and honest summary in Hebrew, max 15 words), 
            "common_faults": [
                "תקלה 1 (למשל: מחלת גיר DSG, סדקים בבוכנות, מודול מצתים)",
                "תקלה 2 (משהו ספציפי לדגם)",
                "תקלה 3"
            ], 
            "pros": ["יתרון 1", "יתרון 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }]
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        console.log("✅ הדו\"ח נוצר בהצלחה!");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה ב-AI:", error.response?.data || error.message);
        res.status(500).json({ error: "AI Error", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
