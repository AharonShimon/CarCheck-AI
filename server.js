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
else console.log("✅ Server started. Analysis Mode.");

app.post('/analyze-ai', async (req, res) => {
    let { brand, model, submodel, year } = req.body;
    
    // תיקון: אם לא נבחר תת-דגם, משאירים ריק
    if (!submodel || submodel === "null") submodel = "";

    // בניית שם הרכב לניתוח
    const fullCarName = submodel ? `${brand} ${model} ${submodel} (${year})` : `${brand} ${model} (${year})`;
    
    console.log(`🚀 Analyzing: ${fullCarName}`);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `
        Act as an expert Israeli vehicle inspector. 
        Target Vehicle: "${fullCarName}".
        
        Task: Provide a reliability analysis for the Israeli market.
        IMPORTANT: If specific trim ("${submodel}") is missing, analyze the general model for the year ${year}.
        
        Return strict JSON only:
        { 
            "reliability_score": 85, 
            "summary": "Short Hebrew summary regarding reliability and maintenance", 
            "common_faults": ["Fault 1 (Hebrew)", "Fault 2 (Hebrew)", "Fault 3 (Hebrew)"], 
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

        if (!response.ok) throw new Error(`Google Error ${response.status}`);

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        let clean = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });

    } catch (error) {
        console.error("❌ Analysis Error:", error.message);
        res.json({ 
            success: true, 
            aiAnalysis: {
                reliability_score: 75,
                summary: "לא התקבל ניתוח ספציפי עקב תקשורת. מוצג מידע כללי.",
                common_faults: ["בלאי טבעי", "מערכת קירור", "פלסטיקה"],
                pros: ["סחירות", "זמינות חלפים"],
                cons: ["צריכת דלק"]
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
