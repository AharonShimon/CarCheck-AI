const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

// דף הבית
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- נתיב הבדיקה (זה מה שהיה חסר!) ---
app.get('/test-status', async (req, res) => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "test" }] }]
        });
        res.json({ 
            ai_status: "✅ ACTIVE", 
            model: "gemini-2.0-flash",
            server_time: new Date().toISOString() 
        });
    } catch (error) {
        res.json({ 
            ai_status: "❌ ERROR", 
            code: error.response ? error.response.status : "NO_RESPONSE",
            details: error.response ? error.response.data : error.message
        });
    }
});

// נתיב ה-AI הראשי
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const prompt = `נתח רכב: ${brand} ${model} שנת ${year}. סיכום קצר בעברית: אמינות ותקלות נפוצות.`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const aiText = response.data.candidates[0].content.parts[0].text;
        res.json({ success: true, aiAnalysis: aiText });
    } catch (error) {
        console.error("AI Error:", error.response ? error.response.status : error.message);
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

// גיבוי למשרד התחבורה
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
app.listen(PORT, () => console.log(`Server LIVE`));
