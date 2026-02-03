require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// חקירה 1: הגשת ה-HTML מהשורש
app.get('/', (req, res) => {
    console.log("🔍 חקירה: המשתמש ביקש את דף הבית. מגיש index.html מהשורש.");
    res.sendFile(path.join(__dirname, 'index.html'));
});

// חקירה 2: הגדרת נתיב סטטי לשורש (בשביל קבצי CSS/JS אם יהיו)
app.use(express.static(__dirname));

const API_KEY = process.env.GEMINI_API_KEY;

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🤖 חקירת AI החלה עבור: ${brand} ${model} שנת ${year}`);

    if (!API_KEY) {
        console.error("❌ שגיאה: GEMINI_API_KEY לא מוגדר ב-Render!");
        return res.status(500).json({ success: false, error: "Missing API Key" });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: `Analyze car: ${brand} ${model} ${year}. Return JSON only.` }] }],
            generationConfig: { responseMimeType: "application/json" }
        }, { timeout: 15000 });

        console.log("✅ תשובת AI התקבלה");
        res.json({ success: true, aiAnalysis: JSON.parse(response.data.candidates[0].content.parts[0].text) });
    } catch (error) {
        console.error("❌ חקירת AI נכשלה:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 השרת רץ על פורט ${PORT}`));
