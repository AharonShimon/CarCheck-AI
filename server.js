const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// נתיב AI
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    try {
        // שימוש ב-1.5 Flash שהוא יציב יותר בגרסה החינמית
        const MODEL_NAME = "gemini-1.5-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה מומחה רכב. נתח את הרכב: ${brand} ${model} (${year}).
        כתוב סיכום קצר בעברית (עד 4 שורות):
        1. אמינות כללית.
        2. תקלות נפוצות שחובה לבדוק.`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, { timeout: 6000 }); // טיים-אאוט קצר כדי לא לתקוע את המשתמש

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return res.json({ 
                success: true, 
                aiAnalysis: response.data.candidates[0].content.parts[0].text 
            });
        }
        throw new Error("Empty response");

    } catch (error) {
        console.error("AI Error:", error.response?.status || error.message);
        // אנחנו מחזירים שגיאה מסודרת כדי שהלקוח יפעיל את הגיבוי המקומי
        const status = error.response ? error.response.status : 500;
        res.status(status).json({ success: false, error: "AI_UNAVAILABLE" });
    }
});

// נתיב בדיקה (שישאר לך לעתיד)
app.get('/test-status', async (req, res) => {
    res.json({ status: "Server Running", note: "Gov API is client-side only." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
