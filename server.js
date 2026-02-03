const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const API_KEY = process.env.GEMINI_API_KEY;

// --- הגדרות אבטחה וביצועים ---
app.use(helmet({ contentSecurityPolicy: false })); // אבטחת כותרות (בסיסית)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.'))); // הגשת קבצים סטטיים

// הגבלת בקשות (Rate Limiting) - למניעת עומס
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 דקות
    max: 50, // מקסימום 50 בקשות לכל IP
    message: { error: "Too many requests, please try again later." }
});
app.use('/analyze-ai', limiter);
app.use('/get-car-details', limiter);

// זיכרון מטמון (Cache) - שומר תוצאות ל-24 שעות
const aiCache = new NodeCache({ stdTTL: 86400 });

// --- דף הבית ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- נתיב ה-AI המשודרג (מחזיר JSON) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    // ולידציה
    if (!brand || !model || !year) {
        return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    // בדיקה ב-Cache
    const cacheKey = `${brand}-${model}-${year}`.toLowerCase();
    const cachedResult = aiCache.get(cacheKey);
    
    if (cachedResult) {
        console.log(`⚡ Serving from Cache: ${cacheKey}`);
        return res.json({ success: true, data: cachedResult, source: "cache" });
    }

    try {
        console.log(`🤖 Fetching new analysis for: ${brand} ${model} ${year}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        
        // פרומפט מהונדס לקבלת JSON בלבד
        const prompt = `
        Act as an expert car mechanic. Analyze: ${brand} ${model} year ${year}.
        Return ONLY a raw JSON object (no markdown, no backticks) with this structure:
        {
            "summary": "Short Hebrew summary of the car (max 20 words)",
            "pros": ["Hebrew pro 1", "Hebrew pro 2", "Hebrew pro 3"],
            "cons": ["Hebrew con 1", "Hebrew con 2", "Hebrew con 3"],
            "reliability_score": 1-10 (number only),
            "common_faults": ["Fault 1", "Fault 2"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        let aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // ניקוי הטקסט למקרה שג'מיני מוסיף ```json
        if (aiText) {
            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(aiText);
            
            // שמירה בזיכרון
            aiCache.set(cacheKey, parsedData);
            
            res.json({ success: true, data: parsedData, source: "live_api" });
        } else {
            throw new Error("Empty response from AI");
        }

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ success: false, error: "AI analysis failed" });
    }
});

// --- נתיב משרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Pro Server running on port ${PORT}`));
