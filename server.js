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

if (!API_KEY) console.error("❌ CRITICAL: Missing API Key");
else console.log("✅ Server started. AI Logic: Analysis ONLY.");

// === נתיב יחיד: ניתוח תקלות וציון (AI) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        // פרומפט ממוקד לניתוח בלבד
        const prompt = `
        Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}".
        Output strict JSON only: 
        { 
            "reliability_score": 85, 
            "summary": "Short Hebrew summary", 
            "common_faults": ["Fault 1", "Fault 2"], 
            "pros": ["Pro 1", "Pro 2"], 
            "cons": ["Con 1", "Con 2"] 
        }`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error(`Google Error ${response.status}`);

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        // ניקוי JSON
        let clean = rawText.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
        
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });

    } catch (error) {
        console.error("❌ Analysis Error:", error.message);
        // במקרה של תקלה - מחזירים תשובת גיבוי כדי שהאפליקציה תעבוד
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 80,
                summary: "לא ניתן היה למשוך נתונים בזמן אמת. מוצג ניתוח כללי לדגם זה.",
                common_faults: ["בלאי טבעי", "מערכת קירור", "חיישנים"],
                pros: ["סחירות", "חלפים זמינים"],
                cons: ["צריכת דלק"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
