import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// הגדרות נחוצות כדי ש-Node.js יבין איפה אנחנו נמצאים (בשיטת import)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// הגשת קבצים סטטיים (HTML, CSS, JS) מהתיקייה הנוכחית
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציה לשליחה לגוגל ג'מיני
async function askGemini(prompt) {
    if (!API_KEY) {
        console.error("Error: Missing GEMINI_API_KEY in .env file");
        throw new Error("API Key missing");
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
}

// פונקציה לניקוי התשובה של ה-AI (משאירה רק JSON)
function cleanJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) { return null; }
}

// === נתיב הניתוח הראשי ===
app.post('/analyze-ai', async (req, res) => {
    try {
        // קבלת הנתונים מהלקוח, כולל ההערות החדשות
        const { brand, model, year, engine, trim, userNotes } = req.body;
        
        console.log(`🤖 Analyzing: ${brand} ${model} (${year}) | Notes: ${userNotes || "None"}`);

        // ההנחיה ל-AI (הפרומפט)
        const prompt = `
        Act as a senior Israeli car mechanic and expert buyer consultant.
        
        Car Details:
        - Model: ${brand} ${model}
        - Year: ${year}
        - Engine: ${engine}
        - Trim: ${trim}
        - User Observations/Notes: "${userNotes || "None"}"

        Task: Provide a short, professional analysis in Hebrew.
        If the user notes indicate a serious problem (e.g., 'white smoke', 'slipping gears'), reflect that in the score and faults.
        
        Output MUST be valid JSON only (no markdown):
        {
            "reliability_score": 85,
            "summary": "Short paragraph in Hebrew. Direct and professional.",
            "pros": ["Pro 1", "Pro 2"],
            "common_faults": ["Fault 1", "Fault 2"]
        }
        `;

        const rawText = await askGemini(prompt);
        const analysis = cleanJSON(rawText);

        if (!analysis) throw new Error("Failed to parse AI response");

        res.json({ success: true, aiAnalysis: analysis });

    } catch (e) {
        console.error("AI Error:", e.message);
        // תשובת גיבוי למקרה של תקלה בשרת
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 80,
                summary: "לא הצלחנו ליצור קשר עם השרת כרגע, אך דגם זה נחשב בדרך כלל לאמין. מומלץ לבצע את בדיקת השטח בקפידה.",
                pros: ["רכב פופולרי", "חלפים זמינים"],
                common_faults: ["בלאי טבעי", "מערכת חשמל"]
            } 
        });
    }
});

// נתיב ברירת מחדל שמגיש את האתר
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// הפעלת השרת
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
