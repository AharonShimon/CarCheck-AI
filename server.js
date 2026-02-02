const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// בדיקה שמפתח ה-API קיים
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ CRITICAL ERROR: GEMINI_API_KEY is missing in Render Environment!");
} else {
    console.log("✅ API Key found (starts with):", process.env.GEMINI_API_KEY.substring(0, 5) + "...");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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
            return res.json({ success: true, data: response.data.result.records[0] });
        }
        return res.json({ success: false, error: "NOT_FOUND" });
    } catch (err) {
        return res.json({ success: false, error: "API_ERROR" });
    }
});

// --- נתיב 2: AI (הכי פשוט שיש) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    try {
        console.log(`🤖 Asking AI about: ${brand} ${model}...`);
        
        // שימוש במודל הכי חדש וסטנדרטי
        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `רכב: ${brand} ${model} שנת ${year}. תן סיכום אמינות ותקלות נפוצות בעברית.`;
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("✅ AI Success!");
        res.json({ success: true, aiAnalysis: text });

    } catch (error) {
        // הדפסת השגיאה המלאה כדי שנבין מה קרה
        console.error("❌ AI FAILED DETAILED ERROR:");
        console.error(JSON.stringify(error, null, 2)); // מדפיס את כל אובייקט השגיאה
        
        if (error.message) console.error("Error Message:", error.message);

        res.status(500).json({ 
            success: false, 
            error: "AI_FAILED", 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
