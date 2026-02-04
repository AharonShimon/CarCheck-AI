require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// נתיב ראשי (מגיש את ה-HTML)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// קריאת המפתח מהסביבה
const API_KEY = process.env.GEMINI_API_KEY; 

// בדיקת מפתח בעלייה
if (!API_KEY) {
    console.error("❌ CRITICAL: API Key is missing in environment variables!");
} else {
    console.log("✅ Server started. API Key loaded successfully.");
}

// ==========================================
// נתיב 1: שליפת תתי-דגם (לטעינת התפריטים)
// ==========================================
app.post('/get-car-options', async (req, res) => {
    try {
        const { type, brand, model } = req.body;
        console.log(`📋 בקשת רשימה (${type}): ${brand} ${model || ''}`);

        let prompt = "";
        if (type === 'models') {
            prompt = `List the 20 most popular car models for "${brand}" sold in Israel. Return ONLY a raw JSON array of strings. No Markdown. Example: ["Corolla", "Yaris"]`;
        } else if (type === 'submodels') {
            prompt = `List the popular trim levels and engine variants for "${brand} ${model}" sold in Israel. Return ONLY a raw JSON array of strings. No Markdown. Example: ["1.6 Sun", "1.8 Hybrid", "1.2 Turbo"]`;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        console.log("⏳ שולח בקשה ל-Gemini...");
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
                temperature: 0.0,
                responseMimeType: "application/json" 
            }
        });

        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        console.log("🔹 תשובה התקבלה:", rawText.substring(0, 50) + "..."); // מדפיס חלק מהתשובה לבדיקה

        // ניקוי והגנה מקריסה
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        let parsedOptions = [];
        try {
            parsedOptions = JSON.parse(rawText);
        } catch (e) {
            console.error("⚠️ שגיאת פענוח JSON מה-AI. מחזיר רשימה ריקה.");
            parsedOptions = [];
        }
        
        res.json({ success: true, options: parsedOptions });

    } catch (error) {
        console.error("❌ שגיאה בשליפת רשימות:", error.response?.data || error.message);
        res.json({ success: false, options: [] });
    }
});

// ==========================================
// נתיב 2: ניתוח הרכב המלא (לכפתור הניתוח)
// ==========================================
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 בקשת ניתוח: ${brand} ${model} (${year})`);
    
    if (!API_KEY) return res.status(500).json({ error: "חסר מפתח API" });

    try {
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
                temperature: 0.0, 
                responseMimeType: "application/json" 
            }
        });
        
        let rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(rawText) });

    } catch (error) {
        console.error("❌ שגיאה בניתוח:", error.response?.data || error.message);
        res.status(500).json({ error: "AI Analysis Failed" });
    }
});

// === בדיקת דופק מהירה ===
app.get('/test', (req, res) => {
    res.json({ 
        status: "OK", 
        message: "השרת חי ובועט!", 
        hasKey: !!process.env.GEMINI_API_KEY,
        model: "gemini-2.5-flash"
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
