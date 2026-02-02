const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path'); // מודול לניהול נתיבי קבצים
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// הגדרת ה-AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- פתרון לשגיאת ה-GET / ---
// הקוד הזה אומר לשרת: כשמישהו נכנס לכתובת הראשית, שלח לו את קובץ ה-HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// נתיב הניתוח (API)
app.post('/analyze-car', async (req, res) => {
    const { plate, brand, model, year } = req.body;
    let finalBrand = brand;
    let finalModel = model;
    let finalYear = year;
    let govData = null;

    try {
        // בדיקה מול משרד התחבורה
        if (plate && plate.length >= 7) {
            const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&filters={"mispar_rechev":"${plate}"}`;
            const govRes = await axios.get(govUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            if (govRes.data.result.records.length > 0) {
                govData = govRes.data.result.records[0];
                finalBrand = govData.tozeret_nm.trim();
                finalModel = govData.kinuy_mishari.trim();
                finalYear = govData.shnat_yitzur;
            }
        }

        if (!finalBrand) {
            return res.status(400).json({ error: "נא להזין פרטי רכב" });
        }

        // ניתוח AI
        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `אתה מומחה רכב ישראלי בכיר. נתח את הרכב: ${finalBrand} ${finalModel} שנת ${finalYear}.
        1. תן ציון אמינות כללי מתוך 5 כוכבים (לדוגמה: ⭐⭐⭐⭐).
        2. פרט ב-3-4 נקודות קצרות תקלות נפוצות (מכניות/חשמליות/מחלות דגם).
        רשום הכל בעברית בצורה מקצועית.`;
        
        const result = await aiModel.generateContent(prompt);
        const aiText = result.response.text();

        res.json({
            govData: govData,
            aiAnalysis: aiText,
            detectedInfo: { brand: finalBrand, model: finalModel, year: finalYear }
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "שגיאה בניתוח" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
