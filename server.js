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

// פונקציית עזר להמתנה (שינה)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// נתיב AI עם מנגנון Retry חכם
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    
    // ננסה עד 3 פעמים להתגבר על שגיאת 429
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            const MODEL_NAME = "gemini-2.0-flash"; // מודל מהיר
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
            
            const prompt = `רכב: ${brand} ${model} שנת ${year}.
            תן סיכום קצר (עד 4 שורות):
            1. ציון אמינות (⭐).
            2. תקלות נפוצות.
            תהיה מקצועי.`;

            const response = await axios.post(url, {
                contents: [{ parts: [{ text: prompt }] }]
            }, { timeout: 8000 }); // הגבלת זמן ל-8 שניות

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return res.json({ 
                    success: true, 
                    aiAnalysis: response.data.candidates[0].content.parts[0].text 
                });
            }
            throw new Error("Empty response");

        } catch (error) {
            attempts++;
            console.log(`AI Attempt ${attempts} failed:`, error.response?.status || error.message);
            
            // אם זו שגיאת עומס (429), נחכה 2 שניות וננסה שוב
            if (error.response && error.response.status === 429 && attempts < maxAttempts) {
                await sleep(2000);
                continue; // נסה שוב
            }
            
            // אם הגענו לפה, זהו כישלון סופי
            if (attempts === maxAttempts) {
                return res.status(error.response?.status || 500).json({ 
                    success: false, 
                    error: "AI_BUSY_OR_FAILED" 
                });
            }
        }
    }
});

// נתיב גיבוי לממשלה (למקרה שהלקוח נכשל)
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(govUrl, { timeout: 4000 });
        
        if (response.data.result.records.length > 0) {
            res.json({ success: true, data: response.data.result.records[0] });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        // ברוב המקרים ב-Render זה יכשל בגלל חסימת IP, אנחנו מחזירים תשובה נקייה
        res.json({ success: false, error: "BLOCKED" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
