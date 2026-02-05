require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === רשימת המודלים לגיבוי (לפי סדר עדיפות) ===
const AI_MODELS = [
    "gemini-1.5-flash",        // עדיפות 1: הכי מהיר וזול
    "gemini-2.0-flash-exp",    // עדיפות 2: גרסה חדשה ומהירה
    "gemini-1.5-pro"           // עדיפות 3: הכי חכם (אך איטי יותר)
];

// === זיכרון מטמון ===
const SPECS_DB = {}; 

// === פונקציית העל: מנסה מודלים בשרשרת ===
// זו הפונקציה החכמה שתציל אותנו מקריסות
async function callAIWithFallback(promptText) {
    let lastError = null;

    for (const model of AI_MODELS) {
        try {
            console.log(`🤖 מנסה את מודל: ${model}...`);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    // ביטול חסימות כדי שהמודל השני לא ייחסם גם הוא
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            const data = await response.json();

            // אם יש שגיאה מה-API עצמו
            if (data.error) throw new Error(data.error.message);
            
            // אם אין תוכן
            if (!data.candidates || !data.candidates[0]) throw new Error("תשובה ריקה מהמודל");

            // הצלחה! מחזירים את הטקסט
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.warn(`⚠️ מודל ${model} נכשל: ${error.message}`);
            lastError = error;
            // ממשיכים למודל הבא בלולאה...
        }
    }

    // אם הגענו לפה - כל המודלים נכשלו
    throw lastError;
}

// === הפרומפטים ===
const generateSpecsPrompt = (brand, model, year) => {
    return `
    List the engine options and trim levels for a ${year} ${brand} ${model} sold in Israel.
    Return JSON only:
    { "engines": ["1.6 Petrol", "Hybrid"], "trims": ["Active", "Premium"] }
    `;
};

const generateAnalysisPrompt = (brand, model, year, engine, trim, faults) => {
    return `
    אתה שמאי רכב ומוסכניק ישראלי מומחה. רכב: ${brand} ${model} ${year} (${engine}), גימור: ${trim}.
    ליקויים: ${faults && faults.length > 0 ? faults.join(', ') : "ללא ליקויים מיוחדים."}
    תחזיר רק JSON:
    {
      "reliability_score": מספר (1-100),
      "summary": "סיכום בעברית",
      "common_faults": ["תקלה 1 - מחיר", "תקלה 2 - מחיר"],
      "negotiation_tip": "טיפ למומ"
    }
    `;
};

// === נתיב 1: שליפת מפרטים (עם גיבוי משולש) ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    const cacheKey = `${brand}-${model}-${year}`;

    if (SPECS_DB[cacheKey]) return res.json({ success: true, data: SPECS_DB[cacheKey] });

    try {
        if (!API_KEY) throw new Error("Missing API Key");

        // קריאה לפונקציה החכמה שמחליפה מודלים
        const aiText = await callAIWithFallback(generateSpecsPrompt(brand, model, year));
        
        // ניקוי ופרסור ה-JSON
        const cleanJson = aiText.replace(/```json|```/g, '').trim();
        const specs = JSON.parse(cleanJson);

        SPECS_DB[cacheKey] = specs;
        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ כל המודלים נכשלו. מפעיל חירום:", error.message);
        
        // רשת ביטחון אחרונה - סטטי
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "טורבו", "היברידי", "דיזל", "חשמלי"], 
                trims: ["רמת גימור בסיסית", "רמת גימור גבוהה", "לא ידוע"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח (עם גיבוי משולש) ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;

        // קריאה לפונקציה החכמה
        const aiText = await callAIWithFallback(generateAnalysisPrompt(brand, model, year, engine, trim, faults));
        
        const cleanJson = aiText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanJson);
        
        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Failed:", error);
        res.status(500).json({ 
            success: false, 
            aiAnalysis: {
                reliability_score: 70,
                summary: "לא ניתן ליצור קשר עם שרת הניתוח כרגע.",
                common_faults: ["שגיאת תקשורת"],
                negotiation_tip: "נסה שוב מאוחר יותר"
            }
        });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
