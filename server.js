require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// הגדרות אבטחה
app.use(helmet());
app.use(cors());
app.use(express.json());

// הגשת קבצים סטטיים (האתר עצמו)
app.use(express.static(path.join(__dirname, 'public')));

// הגבלת בקשות למניעת קריסה (50 בקשות ב-15 דקות)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Too many requests, please try again later." }
});
app.use('/analyze-ai', apiLimiter);

const API_KEY = process.env.GEMINI_API_KEY;

// פונקציית עזר לניקוי ה-JSON שה-AI מחזיר
const cleanJsonString = (str) => {
    // מסיר סימוני Markdown ורווחים מיותרים
    return str.replace(/```json/g, '').replace(/```/g, '').trim();
};

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    if (!brand || !model || !year) {
        return res.status(400).json({ success: false, error: "Missing details" });
    }

    // הפרומפט החדש והמדויק שמחייב JSON
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
            console.log(`Trying ${modelName}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
            
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { responseMimeType: "application/json" } // הכרחת JSON ברמת ה-API
            }, { timeout: 12000 });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const rawText = response.data.candidates[0].content.parts[0].text;
                // המרה לאובייקט JS אמיתי
                const parsedData = JSON.parse(cleanJsonString(rawText));
                return res.json({ success: true, aiAnalysis: parsedData });
            }
        } catch (error) {
            console.error(`Error with ${modelName}:`, error.message);
            // ממשיך למודל הבא אם נכשל
        }
    }

    res.status(500).json({ success: false, error: "AI Service Unavailable" });
});

// כל שאר הבקשות יחזירו את האתר
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
