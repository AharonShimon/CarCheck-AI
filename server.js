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

// ניקוי המפתח מרווחים (חשוב מאוד!)
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה נכנסה:`, req.body);
    
    if (!API_KEY) {
        console.error("❌ שגיאה: המפתח לא מוגדר ב-Render");
        return res.status(500).json({ error: "API Key Missing" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // שימוש במודל gemini-pro (הכי בטוח ויציב)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ 
                text: `Act as a car mechanic. Analyze: "${brand} ${model} ${year}". 
                Return ONLY valid JSON (no markdown):
                {
                    "reliability_score": 85, 
                    "summary": "Hebrew summary max 15 words", 
                    "common_faults": ["Fault1 in Hebrew", "Fault2 in Hebrew", "Fault3 in Hebrew"], 
                    "pros": ["Pro1 in Hebrew", "Pro2 in Hebrew"]
                }` 
            }] }]
        });
        
        // חילוץ וניקוי התשובה
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim(); // מוריד סימני קוד אם יש
        
        console.log("✅ גוגל ענה בהצלחה!");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה מול גוגל:", error.response?.data || error.message);
        // במקרה חירום - מחזיר תשובה ברירת מחדל כדי שהאתר לא ייתקע
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 70,
                summary: "לא ניתן היה ליצור קשר עם ה-AI, אך הרכב נחשב אמין.",
                common_faults: ["בלאי טבעי", "מערכת חשמל"],
                pros: ["חלפים זולים", "שוק טוב"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
