require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// === הגדרות אבטחה ומידע ===
app.use(cors());
app.use(express.json());

// === 🚨 התיקון הקריטי לעיצוב 🚨 ===
// השורה הזו אומרת לשרת: "מותר לך להגיש את style.css, app.js ו-config.js לדפדפן"
app.use(express.static(path.join(__dirname))); 

const API_KEY = process.env.GEMINI_API_KEY;

// === המוח: יצירת הפרומפט ל-AI ===
const generatePrompt = (brand, model, year, engine, trim, faults) => {
    return `
    פעל כמו שמאי רכב ומוסכניק בכיר וקשוח בישראל.
    הרכב הנבדק: ${brand} ${model} שנת ${year}
    מנוע: ${engine}
    רמת גימור: ${trim}
    
    בבדיקה הפיזית נמצאו הליקויים הבאים:
    ${faults.length > 0 ? faults.join(', ') : "הרכב נראה נקי מליקויים חיצוניים/מכאניים ברורים."}

    עליך להחזיר פלט JSON בלבד (ללא טקסט נוסף) במבנה הבא:
    {
      "reliability_score": מספר בין 1-100,
      "summary": "סיכום קצר וחד על הרכב (האם זו עסקה טובה או בור ללא תחתית?)",
      "common_faults": [
        "שם הליקוי שמצא המשתמש (או מחלה ידועה של הרכב) - עלות תיקון מוערכת: X-Y ₪"
      ],
      "negotiation_tip": "המלצה סופית: כמה להוריד מהמחירון בשקלים עקב הליקויים?"
    }
    
    הנחיות קריטיות:
    1. אם המשתמש מצא "בועות במים" או "טחינה בשמן" - זה נזק מנוע קריטי, הציון חייב להיות מתחת ל-40.
    2. תן מחירים ריאליים למוסכים בישראל.
    `;
};

// === הנתיב שמקבל את הבקשה מהאפליקציה ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        console.log(`🤖 מנתח רכב: ${brand} ${model} (${year})`);

        // שליחה לגוגל ג'מיני
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: generatePrompt(brand, model, year, engine, trim, faults) }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();

        // טיפול בתשובה מה-AI
        if (data.candidates && data.candidates[0].content) {
            let aiText = data.candidates[0].content.parts[0].text;
            // ניקוי סימנים מיותרים אם ה-AI מוסיף אותם בטעות
            aiText = aiText.replace(/```json|```/g, '').trim();
            
            const result = JSON.parse(aiText);
            res.json({ success: true, aiAnalysis: result });
        } else {
            throw new Error("Invalid AI response");
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ 
            success: false, 
            aiAnalysis: {
                reliability_score: 0,
                summary: "שגיאה בתקשורת עם השרת. נסה שוב מאוחר יותר.",
                common_faults: [],
                negotiation_tip: "לא ניתן לחשב כרגע."
            }
        });
    }
});

// === נתיב ברירת מחדל (מחזיר את האתר עצמו) ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// === הפעלת השרת ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 CarCheck Server running on port ${PORT}`));
