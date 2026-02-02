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

// נתיב ה-AI המשודרג - פנייה ישירה ל-v1beta
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const MODEL_NAME = "gemini-2.0-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה בוחן רכב מקצועי. נתח את הרכב: ${brand} ${model} שנת ${year}. 
        תן סיכום בעברית: 
        1. ציון אמינות (⭐).
        2. "מחלות דגם" ותקלות נפוצות שחובה לבדוק.
        תהיה קצר, מקצועי וחד.`;

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
        console.error("AI Error:", error.response ? error.response.status : error.message);
        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            error: error.response && error.response.status === 429 ? "TOO_MANY_REQUESTS" : "AI_FAILED" 
        });
    }
});

// נתיב גיבוי למשרד התחבורה (במקרה שהלקוח נכשל)
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(govUrl);
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false, error: "NOT_FOUND" });
        }
    } catch (e) { res.status(500).json({ success: false, error: "GOV_ERROR" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
