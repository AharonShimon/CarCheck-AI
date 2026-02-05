require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// === הפונקציה הישנה והטובה שעבדה ===
async function askGoogle(prompt) {
    // משתמשים בכתובת הישירה, בלי ספריות
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();

    // בדיקה פשוטה אם יש שגיאה
    if (data.error) {
        console.error("❌ Google Error:", data.error.message);
        throw new Error(data.error.message);
    }

    // חילוץ הטקסט
    return data.candidates[0].content.parts[0].text;
}

// פונקציית ניקוי (הדבר היחיד שהשארנו מהחדש, כי זה מונע קריסות)
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        return null;
    }
}

// === נתיב 1: מפרטים ===
app.post('/get-specs', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🔍 מפרט: ${brand} ${model} ${year}`);

    try {
        // הפרומפט המקורי שעבד
        const prompt = `Return a JSON list of engine options and trim levels for a ${year} ${brand} ${model} in Israel. Format: {"engines": ["1.6L Petrol", "Hybrid"], "trims": ["Style", "Premium"]}`;
        
        const text = await askGoogle(prompt);
        const specs = extractJSON(text);

        if (!specs) throw new Error("JSON parsing failed");

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("⚠️ תקלה במפרט:", error.message);
        // במקרה חירום - מחזירים רשימה בסיסית שלא תתקע את המשתמש
        res.json({ 
            success: true, 
            data: { engines: ["בנזין", "היברידי", "דיזל"], trims: ["דגם בסיס", "דגם מפואר"] },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `You are a mechanic. Car: ${brand} ${model} ${year} ${engine} ${trim}. Faults: ${faults}. Return JSON: {"reliability_score": 85, "summary": "Hebrew summary", "common_faults": ["Fault 1"], "negotiation_tip": "Tip"}`;

        const text = await askGoogle(prompt);
        const result = extractJSON(text);
        
        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
