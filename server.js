require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();

// הגדרות מטמון (Cache) - שומר תשובות ל-24 שעות
const aiCache = new NodeCache({ stdTTL: 86400 });

// אבטחה
app.use(helmet());
app.use(cors());
app.use(express.json());

// הגשת קבצים סטטיים (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// הגבלת עומס (Rate Limit)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Too many requests, slow down." }
});
app.use('/analyze-ai', apiLimiter);

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציית עזר לניקוי פלט ה-AI
const cleanJsonString = (str) => {
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
};

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    if (!brand || !model || !year) {
        return res.status(400).json({ success: false, error: "Missing vehicle details" });
    }

    // 1. בדיקה אם התשובה כבר קיימת בזיכרון (חוסך כסף וזמן)
    const cacheKey = `${brand}-${model}-${year}`;
    const cachedData = aiCache.get(cacheKey);
    if (cachedData) {
        console.log(`Serving from cache: ${cacheKey}`);
        return res.json({ success: true, aiAnalysis: cachedData, source: 'cache' });
    }

    // 2. אם לא קיים, פונים ל-Gemini
    const systemPrompt = `
    Act as an expert car mechanic specialized in the Israeli market.
    Analyze: ${brand} ${model} year ${year}.
    
    Return a STRICT VALID JSON object with this structure (no extra text/markdown):
    {
        "reliability_score": Integer (0-100),
        "common_faults": ["fault 1", "fault 2"],
        "pros": ["pro 1", "pro 2"],
        "summary": "Short professional summary in Hebrew (max 2 sentences)."
    }
    Important: All text values inside the JSON must be in Hebrew.
    `;

    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash"];

    for (let modelName of modelsToTry) {
        try {
            console.log(`Querying ${modelName} for ${cacheKey}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
            
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            }, { timeout: 15000 });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const rawText = response.data.candidates[0].content.parts[0].text;
                const parsedData = JSON.parse(cleanJsonString(rawText));
                
                // שמירה בזיכרון לפעם הבאה
                aiCache.set(cacheKey, parsedData);
                
                return res.json({ success: true, aiAnalysis: parsedData, source: 'api' });
            }
        } catch (error) {
            console.error(`Error with ${modelName}:`, error.message);
        }
    }

    res.status(500).json({ success: false, error: "AI Service Unavailable" });
});

// ניתוב ל-SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
