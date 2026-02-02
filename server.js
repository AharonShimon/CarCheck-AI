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

// נתיב ה-AI המשודרג
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const MODEL_NAME = "gemini-2.0-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה בוחן רכב מומחה. נתח את הרכב: ${brand} ${model} שנת ${year}. 
        תן סיכום בעברית: 
        1. ציון אמינות (⭐).
        2. "מחלות דגם" ותקלות נפוצות.
        תהיה קצר ומקצועי.`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const aiText = response.data.candidates[0].content.parts[0].text;
        res.json({ success: true, aiAnalysis: aiText });
    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
