require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === ה-Prompt החדש: בוחן קשוח + מנהל מו"מ ===
const generatePrompt = (brand, model, year, engine, faults) => {
    return `
    אתה שמאי רכב ומוסכניק בכיר בישראל.
    הרכב הנבדק: ${brand} ${model} שנת ${year} (מנוע ${engine}).
    
    המערכת זיהתה את הליקויים הבאים בבדיקה פיזית:
    ${faults.length > 0 ? faults.join(', ') : "לא נמצאו ליקויים מיוחדים (רכב נקי)."}

    משימה:
    1. תן ציון אמינות משוקלל (1-100) לרכב הזה ספציפית.
    2. עבור כל ליקוי שנמצא, הערך את עלות התיקון בשקלים (טווח מינימום-מקסימום) לפי מחירי מוסכים בישראל.
    3. אם אין ליקויים, ציין מחלות ידועות של הדגם שכדאי להיזהר מהן בעתיד.
    4. סיכום: כמה כסף להוריד למוכר במשא ומתן?

    החזר JSON בלבד:
    {
      "reliability_score": מספר,
      "summary": "סיכום מילולי קצר",
      "common_faults": ["ליקוי 1 - עלות מוערכת: X ₪", "ליקוי 2 - עלות מוערכת: Y ₪"],
      "negotiation_tip": "המלצה כמה להוריד במחיר"
    }
    `;
};

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year, engine, faults } = req.body;
    
    console.log(`🔍 מנתח: ${brand} ${model} | ליקויים: ${faults.length}`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: generatePrompt(brand, model, year, engine, faults) }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const json = await response.json();
        const aiData = JSON.parse(json.candidates[0].content.parts[0].text);
        
        res.json({ success: true, aiAnalysis: aiData });

    } catch (error) {
        console.error("AI Error:", error);
        // תשובת גיבוי למקרה של תקלה
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 70,
                summary: "לא ניתן היה להתחבר לשרת הניתוח כרגע.",
                common_faults: ["דרושה בדיקה במוסך"],
                negotiation_tip: "לא זמין"
            } 
        });
    }
});

// הגשת דף הבית
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server V3.0 running on port ${PORT}`));
