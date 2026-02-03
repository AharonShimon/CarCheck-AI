require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());

// 1. הגשת הקבצים הסטטיים (ה-HTML)
app.use(express.static(path.join(__dirname)));

// 2. נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const API_KEY = process.env.GEMINI_API_KEY;

// 3. הנתיב שהיה חסר לך! (המוח של ה-AI)
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    console.log(`🚀 בקשה התקבלה: ${brand} ${model} (${year})`);

    if (!API_KEY) {
        console.error("❌ שגיאה: חסר מפתח API בשרת");
        return res.status(500).json({ success: false, error: "API Key Missing" });
    }

    const prompt = `
    Act as an expert car mechanic in Israel.
    Analyze: "${brand} ${model} year ${year}".
    
    Return JSON only (no markdown):
    {
        "reliability_score": (Integer 0-100),
        "summary": (Hebrew summary, max 15 words),
        "common_faults": (Array of 3 Hebrew faults),
        "pros": (Array of 2 Hebrew pros)
    }
    `;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        let rawText = response.data.candidates[0].content.parts[0].text;
        // ניקוי הקוד מסימני Markdown אם יש
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        const aiData = JSON.parse(rawText);

        console.log("✅ תשובה נשלחה לדפדפן");
        res.json({ success: true, aiAnalysis: aiData });

    } catch (error) {
        console.error("❌ שגיאת AI:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
