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
    // כאן ה'model' כולל כבר את התת-דגם והמנוע שהגיעו מהלקוח
    const { brand, model, year } = req.body;

    console.log(`🚀 בקשה חדשה: יצרן: [${brand}] | דגם מלא: [${model}] | שנה: [${year}]`);
    
    if (!API_KEY) return res.status(500).json({ error: "חסר מפתח API" });

    try {
        // שימוש במודל 2.5 כפי שביקשת - המודל הכי חזק לניתוח טקסט
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as a strict, cynical Israeli vehicle inspector. 
        Analyze specifically: "${brand} ${model} year ${year}".

        CRITICAL CONTEXT:
        The model name provided ("${model}") includes the specific Engine size and Trim level (Sub-model). 
        You MUST tailor the faults to this specific engine/transmission combination if applicable (e.g., distinguish between 1.2 Turbo and 1.6 engines).

        RULES:
        1. Link faults to physical checks from the checklist (e.g., "Check oil cap", "Check coolant bubbles").
        2. Provide practical inspection advice in Hebrew brackets for each fault.
        
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
                temperature: 0.0, // דיוק מקסימלי ללא המצאות
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
