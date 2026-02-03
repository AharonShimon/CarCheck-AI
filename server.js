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

// --- נתיב ה-AI המדויק שעבד ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        // שימוש בכתובת המדויקת שעבדה בבדיקה הראשונה
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה מומחה רכב בכיר. נתח את הרכב: ${brand} ${model} שנת ${year}.
        תן סיכום מקצועי בעברית (עד 5 שורות):
        1. ציון אמינות משוער (⭐).
        2. שלוש "מחלות דגם" נפוצות שחובה לבדוק.
        3. האם הרכב מומלץ לקנייה?`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, { timeout: 10000 });

        if (response.data && response.data.candidates) {
            const aiText = response.data.candidates[0].content.parts[0].text;
            res.json({ success: true, aiAnalysis: aiText });
        } else {
            throw new Error("Empty AI response");
        }
    } catch (error) {
        console.error("AI Error Status:", error.response ? error.response.status : "No Response");
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

// --- נתיב בדיקה למשרד התחבורה (Proxy) ---
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
app.listen(PORT, () => console.log(`Server LIVE`));
