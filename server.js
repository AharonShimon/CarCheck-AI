import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// הגדרת נתיבים (נדרש בגלל שימוש ב-import)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// הגדרות שרת
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // מגיש את קבצים הסטטיים (HTML/CSS/JS)

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציה לתקשורת עם גוגל ג'מיני
async function askGemini(prompt) {
    if (!API_KEY) {
        throw new Error("Missing GEMINI_API_KEY in .env file");
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

// פונקציית עזר לניקוי ה-JSON שחוזר מה-AI
function cleanJSON(text) {
    try {
        // מנסה למצוא את ה-JSON בתוך הטקסט (למקרה שה-AI הוסיף מילים מסביב)
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
}

// === הנתיב הראשי לניתוח רכב ===
app.post('/analyze-ai', async (req, res) => {
    try {
        // קבלת הנתונים מהלקוח
        // userNotes עשוי להיות ריק כי הסרנו את השדה, וזה בסדר
        const { brand, model, year, engine, trim, userNotes } = req.body;
        
        console.log(`🤖 AI Request: ${brand} ${model} (${year})`);

        // בניית הפרומפט למוסכניק הווירטואלי
        const prompt = `
        Act as a senior Israeli car mechanic and expert buyer consultant.
        
        Vehicle Details:
        - Car: ${brand} ${model}
        - Year: ${year}
        - Engine: ${engine}
        - Trim: ${trim}
        - User Notes: "${userNotes || "No specific issues reported"}"

        Task:
        Analyze the reliability of this specific car model in the Israeli market context.
        Since there are no specific user notes, base your score on the general reputation, known chronic issues (machalot), and maintenance costs for this specific year and engine.

        Output MUST be valid JSON only (Hebrew language):
        {
            "reliability_score": (Number 0-100, be realistic based on model year),
            "summary": "Short paragraph in Hebrew. Direct and professional bottom line.",
            "pros": ["Pro 1", "Pro 2"],
            "common_faults": ["Fault 1", "Fault 2"]
        }
        `;

        // שליחה ל-AI
        const rawText = await askGemini(prompt);
        const analysis = cleanJSON(rawText);

        if (!analysis) throw new Error("Failed to parse AI response");

        // החזרת תשובה ללקוח
        res.json({ success: true, aiAnalysis: analysis });

    } catch (e) {
        console.error("AI Error:", e.message);
        
        // תשובת ברירת מחדל למקרה של שגיאה (כדי שהאפליקציה לא תיתקע)
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 80,
                summary: "לא ניתן להתחבר לשרת כרגע. באופן כללי, הקפד לבדוק היסטוריית טיפולים.",
                pros: ["רכב פופולרי"],
                common_faults: ["בלאי טבעי"]
            } 
        });
    }
});

// נתיב ברירת מחדל (למקרה שגולשים ישירות לכתובת)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// הפעלת השרת
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
