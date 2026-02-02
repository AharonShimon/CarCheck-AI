const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// הגדרת ה-AI של גוגל
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// הצגת דף הבית (פותר את שגיאת ה-Cannot GET /)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// נתיב הניתוח המרכזי
app.post('/analyze-car', async (req, res) => {
    let { plate, brand, model, year } = req.body;

    try {
        // שלב א': חיפוש במשרד התחבורה אם הוזנה לוחית והשדות ריקים
        if (plate && plate.length >= 7 && !brand) {
            const govUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&filters={"mispar_rechev":"${plate}"}`;
            const govRes = await axios.get(govUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            if (govRes.data.result.records.length > 0) {
                const car = govRes.data.result.records[0];
                brand = car.tozeret_nm.trim();
                model = car.kinuy_mishari.trim();
                year = car.shnat_yitzur;
            }
        }

        // שלב ב': ניתוח AI על בסיס השדות (יצרן ודגם)
        if (!brand || !model) {
            return res.status(400).json({ error: "חובה להזין יצרן ודגם לניתוח ה-AI" });
        }

        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `אתה מומחה רכב ישראלי בכיר. נתח את האמינות של: ${brand} ${model} שנת ${year}.
        1. תן ציון אמינות כללי מתוך 5 כוכבים (למשל: ⭐⭐⭐⭐).
        2. פרט ב-3 נקודות קצרות תקלות נפוצות או "מחלות דגם" המוכרות במוסכים בישראל.
        רשום הכל בעברית בצורה מקצועית.`;
        
        const result = await aiModel.generateContent(prompt);
        const aiText = result.response.text();

        res.json({
            aiAnalysis: aiText,
            detectedInfo: { brand, model, year }
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "שגיאה בתקשורת עם השרת או ה-AI" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server is LIVE on port ${PORT}`));
