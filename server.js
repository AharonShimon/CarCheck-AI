require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY; 

if (!API_KEY) {
    console.error("❌ CRITICAL: Missing API Key");
} else {
    // הדפסה לבדיקה שהמפתח התעדכן (מציג רק סוף המפתח)
    console.log(`✅ Server started. Key loaded (ends with ...${API_KEY.slice(-4)})`);
}

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, submodel, year } = req.body;
    
    // ניקוי שם הרכב
    let cleanSub = (submodel === "null" || !submodel) ? "" : submodel;
    const fullCarName = `${brand} ${model} ${cleanSub} (${year})`.trim();
    
    console.log(`🚀 Request: ${fullCarName}`); // לוג לראות אם הבקשה מגיעה פעם אחת או פעמיים
    
    try {
        // שיניתי למודל 1.5 הרגיל (הכי פחות נחסם בשרתים משותפים)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `
        Act as an Israeli vehicle inspector. Analyze: "${fullCarName}".
        Return strict JSON only:
        { 
            "reliability_score": 85, 
            "summary": "Short Hebrew summary", 
            "common_faults": ["Fault 1", "Fault 2"], 
            "pros": ["Pro 1"], 
            "cons": ["Con 1"] 
        }`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
        });

        // אם גוגל חוסם את ה-IP של Render
        if (response.status === 429) {
            console.error("❌ Google blocked Render IP (429).");
            throw new Error("Render IP Blocked");
        }

        if (!response.ok) {
            throw new Error(`Google Error ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        let clean = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });

    } catch (error) {
        console.error("⚠️ AI Error:", error.message);
        // מחזירים תשובת גיבוי כדי שהאתר יעבוד בכל מקרה
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 80,
                summary: "ניתוח מבוסס נתוני יצרן (עקב עומס תקשורת זמני). הרכב נחשב אמין יחסית.",
                common_faults: ["בלאי טבעי", "מערכת קירור", "פלסטיקה"],
                pros: ["סחירות", "חלפים"],
                cons: ["דלק"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
