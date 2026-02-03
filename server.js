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

// נתיב ה-AI המתוקן - משתמש בשם מודל שקיים אצלך (gemini-2.0-flash)
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        // שימוש במודל שווידאנו שקיים ברשימה שלך בבדיקה הקודמת
        const modelName = "gemini-2.0-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה מומחה רכב. נתח את הרכב: ${brand} ${model} שנת ${year}. 
        תן סיכום מקצועי בעברית (עד 5 שורות):
        1. ציון אמינות (⭐).
        2. שלוש "מחלות דגם" נפוצות.
        3. האם מומלץ?`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (response.data && response.data.candidates) {
            const aiText = response.data.candidates[0].content.parts[0].text;
            res.json({ success: true, aiAnalysis: aiText });
        } else {
            throw new Error("Empty AI response");
        }
    } catch (error) {
        // הדפסת השגיאה ללוג של Render כדי שנדע אם חזר ה-429
        console.error("AI Error:", error.response ? error.response.status : error.message);
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

// נתיב הגיבוי למשרד התחבורה
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE and using gemini-2.0-flash`));
