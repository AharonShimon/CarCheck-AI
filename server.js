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
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- נתיב 1: רק משיכת פרטים ממשרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    const { plate } = req.body;
    
    if (!plate || plate.length < 7) {
        return res.json({ success: false, error: "מספר לוחית לא תקין" });
    }

    try {
        console.log(`Searching Gov DB for: ${plate}`);
        const govUrl = "https://data.gov.il/api/3/action/datastore_search";
        const response = await axios.get(govUrl, {
            params: {
                resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                filters: JSON.stringify({ mispar_rechev: plate.toString().trim() })
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
        } else {
            return res.json({ success: false, error: "NOT_FOUND" });
        }
    } catch (err) {
        console.error("Gov API Error:", err.message);
        return res.json({ success: false, error: "API_ERROR" });
    }
});

// --- נתיב 2: רק ניתוח AI (מקבל יצרן, דגם, שנה) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    if (!brand || !model) {
        return res.json({ success: false, error: "חסרים פרטי רכב" });
    }

    try {
        // מנגנון חכם למציאת מודל עובד (v1)
        const modelsToTry = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
        let aiText = null;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName, apiVersion: "v1" });
                const prompt = `רכב: ${brand} ${model} שנת ${year}.
                תן סיכום קצר וקולע בעברית:
                1. ציון אמינות (⭐).
                2. 3 תקלות נפוצות ("מחלות דגם").
                תהיה מקצועי.`;
                
                const result = await model.generateContent(prompt);
                aiText = result.response.text();
                if (aiText) break; // הצלחנו!
            } catch (e) {
                console.warn(`Model ${modelName} failed, trying next...`);
            }
        }

        if (aiText) {
            res.json({ success: true, aiAnalysis: aiText });
        } else {
            res.status(500).json({ success: false, error: "AI_FAILED" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
