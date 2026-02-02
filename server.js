const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// שליפת המפתח מהסביבה
const API_KEY = process.env.GEMINI_API_KEY;

// הגשת קבצים סטטיים
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- נתיב AI (PRO MODE) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    // ולידציה בסיסית
    if (!brand || !model || !API_KEY) {
        return res.status(400).json({ success: false, error: "Missing data or API Key" });
    }

    try {
        // שימוש במודל Flash 2.0 לביצועים מקסימליים
        const MODEL_NAME = "gemini-2.0-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const prompt = `אתה מומחה רכב בכיר בישראל. הרכב: ${brand} ${model} שנת ${year}.
        תן סיכום קצר, מקצועי וחד (בלי הקדמות):
        1. ציון אמינות משוער (1-5 כוכבים).
        2. שלוש "מחלות ילדות" או תקלות נפוצות שחובה לבדוק בדגם זה.
        3. שורה תחתונה: האם מומלץ?`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, {
            timeout: 10000 // הגבלת זמן ל-10 שניות
        });

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const aiText = response.data.candidates[0].content.parts[0].text;
            res.json({ success: true, aiAnalysis: aiText });
        } else {
            throw new Error("Empty response from AI");
        }

    } catch (error) {
        // טיפול חכם בשגיאות
        console.error("AI Error:", error.response ? error.response.status : error.message);
        
        let errorMsg = "AI_FAILED";
        if (error.response && error.response.status === 429) {
            errorMsg = "TOO_MANY_REQUESTS"; // זיהוי עומס
        }
        
        res.status(error.response ? error.response.status : 500).json({ 
            success: false, 
            error: errorMsg 
        });
    }
});

// --- נתיב גיבוי למשרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        // שימוש במאגר הממשלתי הראשי
        const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(govUrl, { timeout: 5000 });
        
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false, error: "NOT_FOUND" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: "GOV_API_ERROR" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
