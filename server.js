const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// בדיקת מפתח
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ CRITICAL: GEMINI_API_KEY is missing!");
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- פונקציית עזר: פנייה ישירה לגוגל (עוקף את הספרייה) ---
async function callGeminiDirect(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        // חילוץ הטקסט מהתשובה של גוגל
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Empty response from Gemini");
        }
    } catch (error) {
        console.error("Direct API Error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

// --- נתיב 1: משרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const govUrl = "https://data.gov.il/api/3/action/datastore_search";
        const response = await axios.get(govUrl, {
            params: {
                resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                filters: JSON.stringify({ mispar_rechev: plate })
            },
            timeout: 5000
        });

        if (response.data.success && response.data.result.records.length > 0) {
            const car = response.data.result.records[0];
            return res.json({
                success: true,
                data: {
                    brand: car.tozeret_nm.trim(),
                    model: car.kinuy_mishari.trim(),
                    year: car.shnat_yitzur
                }
            });
        }
        return res.json({ success: false, error: "NOT_FOUND" });
    } catch (err) {
        return res.json({ success: false, error: "API_ERROR" });
    }
});

// --- נתיב 2: AI (בשיטה הישירה) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    try {
        console.log(`🤖 AI Request (Direct): ${brand} ${model} (${year})`);

        const prompt = `רכב: ${brand} ${model} שנת ${year}.
        תן סיכום קצר וקולע בעברית (עד 5 שורות):
        1. ציון אמינות (⭐).
        2. תקלות נפוצות ("מחלות דגם").
        תהיה מקצועי.`;
        
        // שימוש בפונקציה החדשה
        const aiText = await callGeminiDirect(prompt);
        
        console.log("✅ AI Success!");
        res.json({ success: true, aiAnalysis: aiText });

    } catch (error) {
        console.error("❌ AI FAILED.");
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
