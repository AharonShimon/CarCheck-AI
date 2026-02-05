require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === רשימת המודלים לשימוש (לפי סדר עדיפות) ===
const AI_MODELS = [
    "gemini-1.5-flash",        // 1. המהיר והיציב
    "gemini-2.0-flash-exp",    // 2. הניסיוני החדש
    "gemini-1.5-pro"           // 3. החכם והכבד (גיבוי אחרון)
];

// === זיכרון מטמון ===
const SPECS_DB = {}; 

// === פונקציית עזר: חילוץ JSON נקי ===
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/); // מוצא את הסוגריים { }
        if (match) return JSON.parse(match[0]);
        
        const cleanText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return null;
    }
}

// === המנוע המרכזי: רץ על המודלים עד שמצליח ===
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
                    // ביטול כל ההגנות כדי למנוע חסימות סתמיות
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            const data = await response.json();

            // בדיקת שגיאות API
            if (data.error) {
                console.warn(`⚠️ שגיאה במודל ${model}:`, data.error.message);
                throw new Error(data.error.message);
            }

            // בדיקת תשובה ריקה
            if (!data.candidates || !data.candidates[0]) {
                console.warn(`⚠️ מודל ${model} החזיר תשובה ריקה.`);
                throw new Error("Empty response");
            }

            // אם הגענו לפה - יש תשובה!
            console.log(`✅ הצלחה עם מודל: ${model}`);
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            lastError = error;
            // ממשיכים למודל הבא בלולאה...
        }
    }
    
    // אם יצאנו מהלולאה, כולם נכשלו
    throw lastError;
}

// === נתיב 1: שליפת מפרטים (מנוע/גימור) ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    const cacheKey = `${brand}-${model}-${year}`;

    console.log(`🔍 בקשת מפרט: ${brand} ${model} ${year}`);

    // 1. בדיקת זיכרון
    if (SPECS_DB[cacheKey]) {
        console.log("⚡ נשלף מהזיכרון");
        return res.json({ success: true, data: SPECS_DB[cacheKey] });
    }

    try {
        if (!API_KEY) throw new Error("חסר מפתח API בשרת");

        const prompt = `
        You are an expert Israeli car database.
        List ONLY the specific engine options (volume + type) and trim levels (רמות גימור) 
        that were officially sold in Israel for the following car:
        
        Manufacturer: ${brand}
        Model: ${model}
        Year: ${year}
        
        Rules:
        1. Focus ONLY on the Israeli market.
        2. Engines must include volume (e.g., "2.0L SkyActiv", "1.6L Turbo").
        3. Trims must be in English or Hebrew transliteration (e.g., "Executive", "Premium").
        4. Return valid JSON only: {"engines": ["..."], "trims": ["..."]}
        `;

        // קריאה לפונקציה החכמה
        const aiText = await callAIWithFallback(prompt);
        const specs = extractJSON(aiText);

        if (!specs) throw new Error("לא הצלחתי לפענח את ה-JSON");

        // שמירה בזיכרון
        SPECS_DB[cacheKey] = specs;
        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ כשל קריטי (כל המודלים נכשלו):", error.message);
        
        // רשת ביטחון אחרונה: רשימה גנרית כדי שהאפליקציה תעבוד
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "טורבו", "היברידי", "דיזל", "חשמלי"], 
                trims: ["Basic", "Premium", "Luxury", "Sport", "אחר"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח הרכב (מוסכניק) ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `
        פעל כשמאי רכב ומוסכניק ישראלי.
        רכב: ${brand} ${model} שנת ${year} (${engine}), גימור: ${trim}.
        תקלות שדווחו: ${faults && faults.length ? faults.join(',') : "רכב נקי"}.
        
        החזר JSON בלבד:
        {
            "reliability_score": מספר (1-100),
            "summary": "סיכום קצר וחד בעברית",
            "common_faults": ["תקלה 1 (X שח)", "תקלה 2 (Y שח)"],
            "negotiation_tip": "טיפ למומ"
        }`;

        const aiText = await callAIWithFallback(prompt);
        const result = extractJSON(aiText);

        if (!result) throw new Error("Invalid JSON from Analysis");

        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
