require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// נתיב ראשי - מגיש את האתר
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- שים לב: כאן מדביקים את המפתח שלך! ---
const API_KEY = "AIzaSyD4OS_qtVQIfJXlbYZFHqE_71QMBkGZx3s"; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה חדשה: ${req.body.brand} ${req.body.model} (${req.body.year})`);
    
    try {
        const { brand, model, year } = req.body;
        
        // שימוש במודל Gemini 2.5 Flash (הכי חדש ומהיר שפתוח לך)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        // ההנחיה ל-AI: "תחפש מחלות כרוניות ותקלות סדרתיות"
        const smartPrompt = `
        Act as a senior vehicle inspector in Israel. 
        Your task is to identify known "chronic diseases" and common failures reported by users online for the: 
        "${brand} ${model} year ${year}".

        Do NOT provide generic advice like "check tires". 
        Focus on SPECIFIC engine/transmission/electric faults known for this specific model year.

        Return ONLY valid JSON in this format (Hebrew):
        {
            "reliability_score": (Integer 0-100 based on known reliability history), 
            "summary": (A harsh and honest summary in Hebrew, max 15 words), 
            "common_faults": [
                "תקלה 1 (למשל: מחלת גיר DSG, סדקים בבוכנות, מודול מצתים)",
                "תקלה 2 (משהו ספציפי לדגם)",
                "תקלה 3"
            ], 
            "pros": ["יתרון 1", "יתרון 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }]
        });
        
        // ניקוי התשובה מסימנים מיותרים
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        console.log("✅ הדו\"ח נוצר בהצלחה ונשלח לאתר.");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה:", error.response?.data || error.message);
        res.status(500).json({ error: "AI Error", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
