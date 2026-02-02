const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// נתיב AI עם מנגנון התאוששות (Retry)
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    let attempts = 0;
    
    while (attempts < 3) {
        try {
            const MODEL_NAME = "gemini-2.0-flash";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
            
            const prompt = `רכב: ${brand} ${model} שנת ${year}.
            תן סיכום מקצועי בעברית (עד 5 שורות):
            1. ציון אמינות (⭐).
            2. תקלות נפוצות ("מחלות דגם").
            3. שורה תחתונה: האם מומלץ?`;

            const response = await axios.post(url, {
                contents: [{ parts: [{ text: prompt }] }]
            }, { timeout: 9000 });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return res.json({ 
                    success: true, 
                    aiAnalysis: response.data.candidates[0].content.parts[0].text 
                });
            }
            throw new Error("Empty response");

        } catch (error) {
            attempts++;
            console.log(`Attempt ${attempts} failed:`, error.message);
            if (error.response?.status === 429 && attempts < 3) {
                await sleep(2000); // המתנה של 2 שניות במקרה של עומס
                continue;
            }
            if (attempts === 3) {
                return res.status(500).json({ success: false, error: "AI_BUSY" });
            }
        }
    }
});

// נתיב גיבוי למאגר הממשלתי
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(govUrl, { timeout: 5000 });
        
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false, error: "BLOCKED" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
