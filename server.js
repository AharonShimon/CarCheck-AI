require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// רשימת המודלים שהשרת ינסה אחד אחרי השני
const MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-pro", "gemini-1.5-flash-latest"];

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה: ${req.body.brand} ${req.body.model}`);
    
    const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
    if (!API_KEY) return res.status(500).json({ error: "No API Key" });

    const prompt = `
    Act as a car mechanic. Analyze: "${req.body.brand} ${req.body.model} ${req.body.year}". 
    Return ONLY valid JSON (no markdown):
    {
        "reliability_score": (Integer 0-100), 
        "summary": (Hebrew summary max 15 words), 
        "common_faults": [(3 Hebrew faults)], 
        "pros": [(2 Hebrew pros)]
    }`;

    // --- הלולאה החכמה: מנסה מודלים עד שאחד מצליח ---
    for (const model of MODELS_TO_TRY) {
        try {
            console.log(`Trying model: ${model}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            
            const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
            
            let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            rawText = rawText.replace(/```json|```/g, '').trim();
            
            console.log(`✅ הצלחה עם ${model}!`);
            return res.json({ success: true, aiAnalysis: JSON.parse(rawText) }); // יציאה מהפונקציה ברגע שיש הצלחה

        } catch (error) {
            console.warn(`⚠️ נכשל עם ${model} (שגיאה: ${error.response?.status || error.message}). מנסה את הבא...`);
            // ממשיך למודל הבא בלולאה
        }
    }

    // --- אם הגענו לפה, כל המודלים נכשלו ---
    console.error("❌ כל המודלים נכשלו.");
    res.json({ 
        success: true, 
        aiAnalysis: {
            reliability_score: 80,
            summary: "לא ניתן היה להתחבר ל-AI כרגע, אך זהו רכב פופולרי.",
            common_faults: ["בלאי טבעי", "חיישנים"],
            pros: ["חלפים זמינים", "שוק טוב"]
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
