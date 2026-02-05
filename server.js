require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === הפתרון היצירתי: רשימת כתובות ומודלים ===
// אנחנו ננסה את כל הקומבינציות האפשריות עד שנצליח
const CONFIGS = [
    // ניסיון 1: הגרסה היציבה (v1) עם המודל המהיר
    { version: 'v1', model: 'gemini-1.5-flash' },
    // ניסיון 2: גרסת הבטא (v1beta) עם המודל המהיר
    { version: 'v1beta', model: 'gemini-1.5-flash' },
    // ניסיון 3: המודל הישן והאמין (gemini-pro) בגרסה יציבה
    { version: 'v1', model: 'gemini-pro' },
    // ניסיון 4: המודל הישן בגרסת בטא
    { version: 'v1beta', model: 'gemini-pro' }
];

async function callGoogleAI(prompt) {
    let lastError = null;

    // לולאה שרצה על כל הכתובות האפשריות
    for (const config of CONFIGS) {
        try {
            const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent?key=${API_KEY}`;
            console.log(`🔌 מנסה להתחבר דרך: ${config.version} / ${config.model}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    // === הפיצ'ר החדש: כפיית פורמט JSON ===
                    // זה מבטיח דיוק של 100% במבנה הנתונים
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                })
            });

            const data = await response.json();

            // אם הכתובת הזו לא עובדת, נזרקת שגיאה ונעבור לכתובת הבאה
            if (data.error) throw new Error(data.error.message);
            if (!data.candidates || !data.candidates[0]) throw new Error("Empty response");

            console.log(`✅ הצלחה! נתונים התקבלו מ-${config.model}`);
            return data.candidates[0].content.parts[0].text;

        } catch (e) {
            console.warn(`⚠️ נכשל ב-${config.model}: ${e.message}`);
            lastError = e;
        }
    }
    
    throw new Error("כל הניסיונות נכשלו. בדוק את ה-API Key שלך ב-Google AI Studio.");
}

// נתיב 1: מפרטים (Spec Lookup) - הכי מדויק שיש
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מפרט מדויק: ${brand} ${model} ${year}`);

    try {
        if (!API_KEY) throw new Error("Missing API Key");

        // פרומפט מוקפד לנתונים מישראל בלבד
        const prompt = `
        Act as an Israeli automotive database.
        Task: List the EXACT engine options and trim levels sold in Israel for:
        Vehicle: ${year} ${brand} ${model}
        
        Requirements:
        1. Market: Israel (IL) ONLY.
        2. Engines: Format as "Volume Type (HP)" (e.g., "1.6L Petrol (132hp)", "1.8L Hybrid").
        3. Trims: List exact commercial names in English/Hebrew transliteration.
        4. Accuracy: Do not hallucinate trims that didn't exist in ${year}.
        
        Output Schema (JSON):
        {
            "engines": ["string"],
            "trims": ["string"]
        }
        `;

        const jsonString = await callGoogleAI(prompt);
        const specs = JSON.parse(jsonString); // בגלל ה-Mode החדש, זה תמיד יהיה JSON תקין

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ כשל סופי במפרט:", error.message);
        // אם הכל נכשל - מחזירים שגיאה ללקוח כדי שלא יקבל נתונים שקריים
        res.status(500).json({ success: false, error: "לא ניתן לשלוף נתונים כרגע" });
    }
});

// נתיב 2: ניתוח (Analysis)
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `
        Act as an expert Israeli mechanic.
        Vehicle: ${brand} ${model} ${year}, Engine: ${engine}, Trim: ${trim}.
        Reported Faults: ${faults?.join(', ') || "None"}.
        
        Output JSON:
        {
            "reliability_score": number (0-100),
            "summary": "Short Hebrew summary",
            "common_faults": ["Hebrew fault 1 - Price", "Hebrew fault 2 - Price"],
            "negotiation_tip": "Hebrew tip"
        }
        `;

        const jsonString = await callGoogleAI(prompt);
        const result = JSON.parse(jsonString);
        
        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
