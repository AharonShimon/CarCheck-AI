require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === זיכרון מטמון (Database זמני) ===
// כאן נשמור את התוצאות כדי לא לשאול את גוגל כל פעם מחדש
const SPECS_DB = {}; 

// === 1. פרומפט לשליפת מפרטים (מנוע/גימור) ===
const generateSpecsPrompt = (brand, model, year) => {
    return `
    List the engine options and trim levels (רמות גימור) for a ${year} ${brand} ${model} sold in Israel.
    Return JSON only:
    {
      "engines": ["1.6 Hybrid", "1.8 Petrol", ...],
      "trims": ["Style", "Premium", "Iconic", ...]
    }
    Make sure the data is accurate for the Israeli market.
    `;
};

// === 2. פרומפט לניתוח הרכב (הקיים) ===
const generateAnalysisPrompt = (brand, model, year, engine, trim, faults) => {
    return `
    אתה שמאי רכב ומוסכניק ישראלי מומחה.
    רכב: ${brand} ${model} שנת ${year} (${engine}).
    גימור: ${trim}.
    ליקויים שדווחו: ${faults && faults.length > 0 ? faults.join(', ') : "ללא ליקויים מיוחדים."}

    תחזיר רק JSON בפורמט הזה:
    {
      "reliability_score": מספר (1-100),
      "summary": "סיכום קצר בעברית",
      "common_faults": ["תקלה 1 - עלות: X שח", "תקלה 2 - עלות: Y שח"],
      "negotiation_tip": "טיפ למומ"
    }
    `;
};

// נתיב חדש: מביא מנועים ורמות גימור
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    const cacheKey = `${brand}-${model}-${year}`;

    console.log(`🔍 מחפש מפרט עבור: ${cacheKey}`);

    // 1. בדיקה האם יש לנו את זה כבר בזיכרון (חוסך זמן וכסף)
    if (SPECS_DB[cacheKey]) {
        console.log("⚡ נמצא בזיכרון!");
        return res.json({ success: true, data: SPECS_DB[cacheKey] });
    }

    // 2. אם אין - שואלים את ה-AI
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: generateSpecsPrompt(brand, model, year) }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        let aiText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const specs = JSON.parse(aiText);

        // 3. שמירה בזיכרון לפעם הבאה
        SPECS_DB[cacheKey] = specs;
        
        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("Error fetching specs:", error);
        // במקרה חירום מחזירים רשימה גנרית כדי לא לתקוע את האפליקציה
        res.json({ success: false, data: { engines: ["בנזין", "היברידי"], trims: ["לא ידוע"] } });
    }
});

// נתיב הניתוח (הרגיל)
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: generateAnalysisPrompt(brand, model, year, engine, trim, faults) }] }],
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
        let aiText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(aiText);
        
        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
