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

// === נתוני גיבוי (למקרה שה-AI לא זמין/חסום) ===
const BACKUP_ANALYSIS = {
    reliability_score: 82,
    summary: "הערה: הניתוח מבוסס על נתוני יצרן ודיווחים היסטוריים (מצב גיבוי). הרכב נחשב אמין יחסית, אך דורש בדיקה של היסטוריית טיפולים.",
    common_faults: ["בלאי טבעי במערכת המתלים והגומיות", "מערכת קירור (משאבת מים/טרמוסטט)", "חיישני חמצן או ממיר קטליטי", "איכות פלסטיקה פנימית"],
    pros: ["סחירות טובה ושוק חזק", "זמינות חלפים גבוהה", "עלויות אחזקה סבירות"],
    cons: ["צריכת דלק ממוצעת", "בידוד רעשים בינוני"]
};

if (!API_KEY) console.error("❌ CRITICAL: Missing API Key");
else console.log("✅ Server started. Using NEW Model: Gemini 2.0 Flash.");

app.post('/analyze-ai', async (req, res) => {
    let { brand, model, submodel, year } = req.body;
    
    // ניקוי ערכים
    if (!submodel || submodel === "null") submodel = "";
    
    const fullCarName = `${brand} ${model} ${submodel} (${year})`.trim();
    console.log(`🚀 AI Request (2.0 Flash): ${fullCarName}`);
    
    try {
        // === שימוש במודל החדש: gemini-2.0-flash ===
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `
        Act as an expert Israeli vehicle inspector. Analyze: "${fullCarName}".
        Return strict JSON only (no markdown, Hebrew content):
        { 
            "reliability_score": 85, 
            "summary": "Short Hebrew summary (2 sentences)", 
            "common_faults": ["Fault 1 (Hebrew)", "Fault 2 (Hebrew)"], 
            "pros": ["Pro 1 (Hebrew)", "Pro 2 (Hebrew)"], 
            "cons": ["Con 1 (Hebrew)", "Con 2 (Hebrew)"] 
        }`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
        });

        // טיפול בשגיאות נפוצות
        if (response.status === 429) {
            console.warn("⚠️ Quota Exceeded (429). Using Backup.");
            return res.json({ success: true, aiAnalysis: BACKUP_ANALYSIS });
        }
        
        // אם המודל החדש עדיין לא זמין למפתח שלך (404)
        if (response.status === 404) {
            console.warn("⚠️ Model 2.0 not found (404). Consider switching back to 1.5. Using Backup for now.");
            return res.json({ success: true, aiAnalysis: BACKUP_ANALYSIS });
        }

        if (!response.ok) {
            throw new Error(`Google API Error: ${response.status}`);
        }

        const data = await response.json();
        
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        let clean = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });

    } catch (error) {
        console.error("❌ Error:", error.message);
        // רשת ביטחון: תמיד מחזיר תשובה ללקוח
        res.json({ success: true, aiAnalysis: BACKUP_ANALYSIS });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
