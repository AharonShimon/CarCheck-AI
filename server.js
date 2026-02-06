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
    if (!API_KEY) throw new Error("Missing GEMINI_API_KEY");

    // רשימת האפשרויות לניסיון (הכתובות והמודלים הכי נפוצים)
    const configs = [
        { ver: 'v1', model: 'gemini-1.5-flash' },
        { ver: 'v1beta', model: 'gemini-1.5-flash' },
        { ver: 'v1', model: 'gemini-1.5-flash-latest' },
        { ver: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { ver: 'v1', model: 'gemini-1.5-pro' }
    ];

    let lastError = null;

    // לולאה שמנסה כל קונפיגורציה עד שאחת מצליחה
    for (const config of configs) {
        try {
            const url = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.model}:generateContent?key=${API_KEY}`;
            
            console.log(`📡 מנסה חיבור: ${config.ver} עם מודל ${config.model}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();

            if (response.ok && data.candidates && data.candidates[0].content) {
                console.log(`✅ הצלחה! מודל עובד: ${config.model} (גרסה ${config.ver})`);
                return data.candidates[0].content.parts[0].text;
            } else {
                console.warn(`⚠️ נכשלו ב-${config.model}: ${data.error?.message || 'שגיאה לא ידועה'}`);
                lastError = data.error?.message || "Unknown API Error";
            }
        } catch (err) {
            console.error(`❌ שגיאת רשת בניסיון ${config.model}:`, err.message);
            lastError = err.message;
        }
    }

    // אם הגענו לכאן, אף אחד לא עבד
    throw new Error(`כל ניסיונות החיבור ל-AI נכשלו. שגיאה אחרונה: ${lastError}`);
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

