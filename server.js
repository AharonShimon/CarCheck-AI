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

// ניקוי רווחים מהמפתח - קריטי למניעת תקלות!
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 נתונים התקבלו:`, req.body);
    
    if (!API_KEY) {
        console.error("❌ שגיאה: המפתח לא מוגדר ב-Render");
        return res.status(500).json({ error: "API Key Missing" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // --- שינוי למודל המהיר שלך: gemini-1.5-flash ---
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ 
                text: `You are a strict car mechanic. 
                Analyze this car: "${brand} ${model} year ${year}". 
                
                Output ONLY valid JSON in this format (no markdown, no backticks):
                {
                    "reliability_score": (integer 0-100), 
                    "summary": (Hebrew text, max 15 words), 
                    "common_faults": [(3 Hebrew faults)], 
                    "pros": [(2 Hebrew pros)]
                }` 
            }] }]
        });
        
        // חילוץ התשובה בצורה בטוחה
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        // ניקוי "לכלוך" שה-AI לפעמים מוסיף (כמו ```json)
        rawText = rawText.replace(/```json|```/g, '').trim(); 
        
        console.log("✅ Gemini 1.5 Flash ענה בהצלחה!");
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה מול גוגל:", error.response?.data || error.message);
        
        // תשובת גיבוי למקרה של תקלה (כדי שהמשתמש לא ייתקע)
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 0,
                summary: "המודל עסוק כרגע, אנא נסה שנית.",
                common_faults: ["שגיאת תקשורת"],
                pros: ["-"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
