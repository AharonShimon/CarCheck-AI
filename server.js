require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// === רשימת המודלים לגיבוי ===
// השרת ינסה אותם לפי הסדר עד שימצא אחד שעובד
const ALL_MODELS = [
    "gemini-1.5-flash",        // המהיר והמומלץ
    "gemini-1.5-flash-001",    // גרסה ספציפית
    "gemini-1.5-flash-002",    // גרסה ספציפית חדשה
    "gemini-2.0-flash-exp",    // החדש ביותר (ניסיוני)
    "gemini-1.5-pro",          // החכם (איטי יותר)
    "gemini-1.5-pro-001",
    "gemini-1.5-pro-002",
    "gemini-1.0-pro",          // דור 1
    "gemini-pro"               // הכינוי הישן (תמיד עובד כגיבוי אחרון)
];

// === פונקציית עזר: חילוץ JSON ===
function extractJSON(text) {
    try {
        // מנסה למצוא את ה-JSON בין הסוגריים המסולסלים
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        
        // מנסה לנקות סימני קוד
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        return null;
    }
}

// === המנוע החכם: רץ על כל המודלים ===
async function generateWithRetry(prompt) {
    let lastError = null;
    console.log("🚀 מתחיל חיפוש במודלים...");

    for (const modelName of ALL_MODELS) {
        try {
            // יצירת מודל
            const model = genAI.getGenerativeModel({ model: modelName });
            
            // שליחה
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            if (text) {
                console.log(`✅ הצלחה! מודל שעבד: ${modelName}`);
                return text; // מצאנו! יוצאים ומחזירים תשובה
            }

        } catch (error) {
            // רק מזהיר וממשיך למודל הבא
            // אנחנו חותכים את הודעת השגיאה כדי שלא תלכלך את הלוג
            console.warn(`⚠️ מודל ${modelName} נכשל: ${error.message.split('[')[0]}... (ממשיך לבא)`);
            lastError = error;
        }
    }

    // אם הגענו לפה - הכל נכשל
    console.error("❌ כל המודלים נכשלו.");
    throw lastError; 
}

// === נתיב 1: מפרטים (עם הפרומפט המדויק לישראל) ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מחפש מפרט ישראלי: ${brand} ${model} ${year}`);
    
    try {
        if (!API_KEY) throw new Error("Missing API Key");

        // הפרומפט הכירורגי
        const prompt = `
        You are an expert Israeli car database.
        List ONLY the specific engine options (volume + type) and trim levels (רמות גימור) 
        that were officially sold in Israel for the following car:
        
        Manufacturer: ${brand}
        Model: ${model}
        Year: ${year}
        
        Rules:
        1. Focus ONLY on the Israeli market (IL).
        2. Engines must include volume (e.g., "2.0L SkyActiv", "1.6L Turbo", "1.2L TSI").
        3. Trims must be in English or Hebrew transliteration (e.g., "Executive", "Premium", "Spirit", "Instyle").
        4. Do NOT invent trims.
        5. Return valid JSON only: {"engines": ["..."], "trims": ["..."]}
        `;

        const text = await generateWithRetry(prompt);
        const specs = extractJSON(text);

        if (!specs) throw new Error("JSON לא תקין");

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ שגיאה סופית במפרט:", error.message);
        
        // רשת ביטחון: רשימה גנרית כדי שהאפליקציה תעבוד
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "טורבו", "היברידי", "דיזל", "חשמלי"], 
                trims: ["רמת גימור בסיסית", "רמת גימור גבוהה", "אחר"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח (מוסכניק) ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        console.log(`🤖 מנתח רכב...`);
        
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

        const text = await generateWithRetry(prompt);
        const jsonResult = extractJSON(text);
        
        res.json({ success: true, aiAnalysis: jsonResult });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
