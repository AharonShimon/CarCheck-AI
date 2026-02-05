require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// הגדרת קובץ ה-HTML כדף הבית
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY;

// רשימת המודלים לניסיון (מדורג מהחכם ביותר ליציב ביותר)
const MODELS = [
    "gemini-2.5-flash", 
    "gemini-2.0-flash", 
    "gemini-1.5-flash"
];

// === פונקציית גיבוי חכם (Offline) במידה וגוגל לא זמין ===
function generateSmartBackup(brand, model, engine) {
    const b = brand.toLowerCase();
    const e = engine ? engine.toLowerCase() : "";
    
    if (e.includes("חשמלי") || b.includes("tesla") || b.includes("byd")) {
        return {
            reliability_score: 88,
            summary: "ניתוח גיבוי (חשמלי): רכב עם מערכת הנעה אמינה, אך דורש בדיקת בריאות סוללה (SOH) ועדכוני תוכנה.",
            common_faults: ["בלאי צמיגים מואץ", "באגים במערכת המולטימדיה", "שקע טעינה"],
            pros: ["ביצועים", "עלות נסיעה"],
            cons: ["ירידת ערך מהירה", "טווח ריאלי"]
        };
    }
    return {
        reliability_score: 75,
        summary: "ניתוח גיבוי: לא ניתן היה להתחבר לשרת ה-AI. על סמך נתונים כלליים, הרכב דורש בדיקה מכאנית קפדנית.",
        common_faults: ["בלאי טבעי במערכת המתלים", "נזילות שמן", "מערכת קירור"],
        pros: ["חלפים זמינים", "סחירות סבירה"],
        cons: ["צריכת דלק", "עלויות תחזוקה משתנות"]
    };
}

// === הראוט המרכזי לניתוח AI ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year, engine, trim } = req.body;
    
    const carInfo = `${brand} ${model} שנת ${year}, מנוע ${engine}, רמת גימור ${trim || 'סטנדרט'}`;
    console.log(`🚀 ניתוח חדש התחיל: ${carInfo}`);

    const expertPrompt = `
    תפקיד: אתה בוחן רכב ישראלי בכיר ומנוסה מאוד (סגנון "מוסכניק של פעם").
    משימה: נתח את הרכב הבא: ${carInfo}.
    
    הנחיות קריטיות:
    1. אל תהיה כללי! ציין מחלות ספציפיות הידועות לשילוב המנוע (${engine}) והגיר בדגם הזה (למשל: בוצה במנוע, התחממות גיר רובוטי, רצועות תזמון רטובות וכו').
    2. התייחס לאמינות המכאנית לטווח ארוך של השנתון הזה (${year}).
    3. מהי רמת הסחירות והביקוש של הדגם הזה בשוק הישראלי?
    4. אם יש מערכות אלקטרוניות או בטיחותיות רגישות, ציין אותן.

    החזר JSON בלבד בעברית בפורמט הזה:
    {
      "reliability_score": מספר (1-100),
      "summary": "סיכום חד ומקצועי",
      "common_faults": ["תקלה 1", "תקלה 2"],
      "pros": ["יתרון 1"],
      "cons": ["חיסרון 1"]
    }
    `;

    let finalData = null;

    // לוגיקת המפל (Cascade) - מנסה מודל אחרי מודל
    for (const modelName of MODELS) {
        try {
            console.log(`🔄 מנסה מודל: ${modelName}`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: expertPrompt }] }],
                    generationConfig: { 
                        temperature: 0.2, // נמוך כדי להישאר עובדתי
                        responseMimeType: "application/json" 
                    }
                })
            });

            if (response.ok) {
                const json = await response.json();
                const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                finalData = JSON.parse(rawText);
                console.log(`✅ הצלחה עם מודל: ${modelName}`);
                break; // הצלחנו, אפשר לצאת מהלולאה
            } else {
                console.warn(`⚠️ מודל ${modelName} נכשל עם סטטוס ${response.status}`);
            }
        } catch (err) {
            console.error(`❌ שגיאה במודל ${modelName}:`, err.message);
        }
    }

    // אם כל המודלים נכשלו או החזירו תשובה ריקה
    if (!finalData) {
        console.error("🔥 כל מודלי ה-AI נכשלו. שולח גיבוי חכם.");
        finalData = generateSmartBackup(brand, model, engine);
    }

    res.json({ success: true, aiAnalysis: finalData });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`----------------------------------------`);
    console.log(`🚗 CarCheck Pro Server is Running!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🛠️ Mode: Production / Expert AI`);
    console.log(`----------------------------------------`);
});
