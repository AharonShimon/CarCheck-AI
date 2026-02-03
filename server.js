require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());

// הגשת קבצים סטטיים (האתר עצמו)
app.use(express.static(path.join(__dirname)));

// נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- שים לב! כאן אתה מדביק את המפתח הארוך שלך ---
const API_KEY = "AIzaSyD4OS_qtVQIfJXlbYZFHqE_71QMBkGZx3s"; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה עבור רכב: ${req.body.brand} ${req.body.model}`);
    
    try {
        const { brand, model, year } = req.body;
        
        // שימוש במודל Gemini 2.5 Flash (שנמצא ברשימה שלך)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ 
                text: `You are an expert car mechanic in Israel. 
                Analyze this car: "${brand} ${model} year ${year}". 
                
                Return ONLY valid JSON in this specific format (do not use markdown blocks):
                {
                    "reliability_score": (Integer between 0-100), 
                    "summary": (Short Hebrew summary, max 15 words), 
                    "common_faults": [(Array of 3 common faults in Hebrew)], 
                    "pros": [(Array of 2 pros in Hebrew)]
                }` 
            }] }]
        });
        
        // חילוץ וניקוי התשובה
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        // מנקה סימנים כמו ```json אם ה-AI מוסיף אותם בטעות
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        console.log("✅ הצלחה! התקבל ניתוח מגוגל.");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה:", error.response?.data || error.message);
        // מחזיר תשובה מסודרת במקרה של שגיאה כדי שהלקוח יבין
        res.status(500).json({ error: "AI Error", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
