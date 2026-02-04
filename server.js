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

// קריאת המפתח מהכספת של Render
const API_KEY = process.env.GEMINI_API_KEY; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה: ${req.body.brand} ${req.body.model} (${req.body.year})`);
    
    // בדיקת הגנה: אם המפתח לא הוגדר ב-Render
    if (!API_KEY) {
        console.error("❌ שגיאה קריטית: חסר מפתח API בהגדרות השרת (Environment Variables)");
        return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // שימוש במודל (ניתן להחליף ל-gemini-1.5-flash אם 2.5 עושה בעיות, אבל נשאר עם מה שעבד לך)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        // --- זה החלק ששודרג ---
        // הוספנו דרישה לסרוק את כל המנועים ולהחזיר גם חסרונות (cons)
        const smartPrompt = `
        Act as a senior vehicle inspector in Israel. 
        Analyze the reliability of: "${brand} ${model} year ${year}".

        CRITICAL INSTRUCTIONS:
        1. Consider ALL common engine variants sold in Israel for this model year (e.g., 1.6L, 1.8L, 2.0L, Diesel, Hybrid, Turbo). Do NOT limit to just one engine type.
        2. Identify "chronic diseases" specific to these engines/transmissions.
        3. Provide specific Pros (יתרונות) AND Cons (חסרונות).

        Return ONLY valid JSON in this format (Hebrew):
        {
            "reliability_score": (Integer 0-100 based on known reliability history), 
            "summary": (A harsh and honest summary in Hebrew, max 20 words. Mention if a specific engine is better/worse), 
            "common_faults": [
                "תקלה 1 (למשל: מחלת גיר DSG, סדקים בבוכנות, מודול מצתים)",
                "תקלה 2 (נא לציין לאיזה מנוע זה רלוונטי אם צריך)",
                "תקלה 3"
            ], 
            "pros": ["יתרון 1", "יתרון 2"],
            "cons": ["חיסרון 1", "חיסרון 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }]
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        // ניקוי הקוד מסימנים מיותרים
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
