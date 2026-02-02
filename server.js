const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// בדיקה שהמפתח קיים ב-Render
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY is missing in Render Environment Variables!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// פונקציית עזר חכמה שמנסה מספר מודלים
async function getAIResponse(prompt) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-pro"]; // סדר עדיפויות
    
    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (text) return text;
        } catch (error) {
            console.warn(`⚠️ Model ${modelName} failed:`, error.message);
            // ממשיכים למודל הבא בלולאה
        }
    }
    throw new Error("All AI models failed to respond.");
}

app.post('/analyze-car', async (req, res) => {
    let { plate, brand, model, year } = req.body;
    let govStatus = "SKIPPED";

    try {
        // 1. משרד התחבורה
        if (plate && plate.length >= 7) {
            try {
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
                    brand = car.tozeret_nm.trim();
                    model = car.kinuy_mishari.trim();
                    year = car.shnat_yitzur;
                    govStatus = "SUCCESS";
                } else {
                    govStatus = "NOT_FOUND";
                }
            } catch (err) {
                console.log("Gov API Error:", err.message);
                govStatus = "API_ERROR";
            }
        }

        // 2. וידוא שיש נתונים לפני AI
        if (!brand || !model) {
            return res.json({ success: false, error: "MISSING_DETAILS", govStatus });
        }

        // 3. הפעלת ה-AI עם המנגנון החכם
        const prompt = `אתה בוחן רכב מקצועי.
        רכב: ${brand} ${model} שנת ${year}.
        כתוב סיכום קצר (עד 4 שורות) בעברית:
        1. ציון אמינות (⭐).
        2. "מחלות דגם" ידועות שחובה לבדוק (כמו גיר, מנוע, חשמל).
        תמקד את הבוחן למה לשים לב בבדיקה פיזית.`;

        const aiText = await getAIResponse(prompt);

        res.json({
            success: true,
            govStatus,
            aiAnalysis: aiText,
            detectedInfo: { brand, model, year }
        });

    } catch (error) {
        console.error("CRITICAL SERVER ERROR:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
