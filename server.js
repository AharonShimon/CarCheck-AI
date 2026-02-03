require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());

// 1. הגשת הקבצים הסטטיים (ה-HTML שבנינו)
app.use(express.static(path.join(__dirname)));

// 2. נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const API_KEY = process.env.GEMINI_API_KEY;

// 3. הנקודה הקריטית: חקירת ה-AI
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    // לוג לשרת כדי שנדע שהבקשה הגיעה
    console.log(`🚀 בקשה חדשה: ${brand} ${model} (${year})`);

    if (!API_KEY) {
        console.error("❌ שגיאה: חסר מפתח API");
        return res.status(500).json({ success: false, error: "API Key Missing" });
    }

    // הנדסת פרומפט (Prompt Engineering) מדויקת לצרכי האפליקציה
    const prompt = `
    Act as an expert car mechanic and data analyst in Israel.
    Analyze this car: "${brand} ${model} year ${year}".
    
    You MUST return the output in valid JSON format ONLY. 
    Do not add Markdown formatting (like \`\`\`json).
    The content MUST be in Hebrew (עברית).

    JSON Structure required:
    {
        "reliability_score": (Integer between 0-100),
        "summary": (A short professional summary in Hebrew, max 20 words),
        "common_faults": (Array of 3-4 specific known mechanical issues in Hebrew),
        "pros": (Array of 2-3 selling points in Hebrew)
    }
    `;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.7 // יצירתיות מאוזנת
            }
        }, { timeout: 20000 }); // הארכנו זמן המתנה ל-20 שניות

        // חילוץ וניקוי התשובה
        let rawText = response.data.candidates[0].content.parts[0].text;
        
        // ניקוי שאריות Markdown אם יש (לביטחון)
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        const aiData = JSON.parse(rawText);

        console.log("✅ AI ניתח בהצלחה:", aiData.reliability_score);
        
        res.json({ 
            success: true, 
            aiAnalysis: aiData 
        });

    } catch (error) {
        console.error("❌ כישלון בניתוח AI:", error.message);
        // אנחנו מחזירים שגיאה כדי שהצד-לקוח יפעיל את ה-Fallback לבדיקה ידנית
        res.status(500).json({ success: false, error: "AI Service Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
