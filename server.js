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

// --- נתיב בדיקה (דיאגנוסטיקה) ---
// חובה לוודא שהקוד הזה קיים כדי שהבדיקה תעבוד!
app.get('/test-status', async (req, res) => {
    let aiMsg = "Unknown";
    let govMsg = "Unknown";
    let models = [];

    // 1. בדיקת AI
    try {
        // בדיקת רשימת מודלים
        const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        models = listRes.data.models.map(m => m.name);
        
        // בדיקת ג'נרוט (Hello World)
        await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
            { contents: [{ parts: [{ text: "Hi" }] }] }
        );
        aiMsg = "✅ AI ACTIVE & WORKING";
    } catch (e) {
        aiMsg = `❌ AI ERROR: ${e.response ? e.response.status : e.message}`;
        if (e.response && e.response.status === 429) aiMsg += " (Quota Exceeded)";
    }

    // 2. בדיקת ממשלה
    try {
        await axios.get("https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&limit=1", { timeout: 3000 });
        govMsg = "✅ GOV API CONNECTED";
    } catch (e) {
        govMsg = "❌ GOV BLOCKED (Expected in Render)";
    }

    res.json({
        timestamp: new Date().toISOString(),
        ai_status: aiMsg,
        gov_status: govMsg,
        available_models: models.filter(m => m.includes('gemini'))
    });
});

// --- נתיב AI לאפליקציה ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: `רכב: ${brand} ${model} (${year}). סיכום אמינות ותקלות קצר.` }] }]
        });
        res.json({ success: true, aiAnalysis: response.data.candidates[0].content.parts[0].text });
    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

// --- נתיב ממשלה (גיבוי) ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data.result.records.length > 0) res.json({ success: true, data: response.data.result.records[0] });
        else res.json({ success: false });
    } catch (e) { res.json({ success: false, error: "BLOCKED" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
