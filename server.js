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

// --- כאן!!! הדבק את המפתח האמיתי שלך בתוך הגרשיים ---
// אל תסמוך על process.env כרגע. נכתוב את זה ישירות.
const API_KEY = "AIzaSyD4OS_qtVQIfJXlbYZFHqE_71QMBkGZx3s"; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בדיקה ישירה עם מפתח קשיח`);
    
    try {
        const { brand, model, year } = req.body;
        
        // משתמשים במודל gemini-1.5-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ 
                text: `Analyze car: ${brand} ${model} ${year}. Return JSON: {"reliability_score": 85, "summary": "Car summary", "common_faults": ["Fault1", "Fault2"], "pros": ["Pro1", "Pro2"]}` 
            }] }]
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        console.log("✅ הצלחה! המפתח הקשיח עבד.");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה:", error.response?.data || error.message);
        // מחזיר את השגיאה האמיתית לדפדפן כדי שתראה אותה
        res.status(500).json({ error: error.message, details: error.response?.data });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
