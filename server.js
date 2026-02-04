require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY; 

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשת ניתוח (Gemini 2.5): ${req.body.brand} ${req.body.model} (${req.body.year})`);
    
    if (!API_KEY) return res.status(500).json({ error: "חסר מפתח API" });

    try {
        const { brand, model, year } = req.body;
        
        // === שימוש בלעדי ב-GEMINI 2.5 FLASH ===
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as a strict, cynical Israeli vehicle inspector. 
        Analyze: "${brand} ${model} year ${year}".

        RULES:
        1. Be specific about engine/transmission faults for this specific model/year in Israel.
        2. Link faults to physical checks from the checklist (e.g., "Check oil cap", "Check coolant bubbles").
        3. Provide practical inspection advice in Hebrew brackets for each fault.
        
        Return JSON (Hebrew):
        {
            "reliability_score": (Integer 0-100), 
            "summary": (Short summary), 
            "common_faults": ["תקלה 1 (איך בודקים בשטח)", "תקלה 2 (איך בודקים בשטח)"], 
            "pros": ["יתרון 1", "יתרון 2"],
            "cons": ["חיסרון 1", "חיסרון 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            generationConfig: { 
                temperature: 0.0, // דיוק מקסימלי
                responseMimeType: "application/json" 
            }
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ error: "AI Analysis Failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
