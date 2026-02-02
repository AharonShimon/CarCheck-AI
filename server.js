const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// בדיקת מפתח
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ CRITICAL: GEMINI_API_KEY is missing!");
} else {
    console.log("✅ API Key loaded.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- נתיב 1: משרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    try {
        console.log(`Searching Gov DB for: ${plate}`);
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
        console.error("Gov API Error:", err.message);
        return res.json({ success: false, error: "API_ERROR" });
    }
});

// --- נתיב 2: AI (התיקון הגדול) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    try {
        console.log(`🤖 AI Request: ${brand} ${model} (${year})`);
        
        // === התיקון: כפיית שימוש ב-API היציב (v1) ===
        const aiModel = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            apiVersion: "v1" 
        });

        const prompt = `רכב: ${brand} ${model} שנת ${year}.
        תן סיכום קצר וקולע בעברית (עד 5 שורות):
        1. ציון אמינות (⭐).
        2. תקלות נפוצות ("מחלות דגם").
        תהיה מקצועי.`;
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("✅ AI Success!");
        res.json({ success: true, aiAnalysis: text });

    } catch (error) {
        // הדפסה מפורטת ללוג
        console.error("❌ AI ERROR DETAILS:", error);
        
        // ניסיון גיבוי למודל ישן יותר אם החדש נכשל
        try {
            console.log("⚠️ Trying backup model (gemini-pro)...");
            const backupModel = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await backupModel.generateContent(`אמינות רכב: ${brand} ${model} ${year}. בעברית.`);
            const text = result.response.text();
            return res.json({ success: true, aiAnalysis: text });
        } catch (backupError) {
            console.error("❌ Backup failed too.");
            res.status(500).json({ success: false, error: "AI_FAILED" });
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
