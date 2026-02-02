const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());

// שימוש במפתח הסודי מהגדרות השרת
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/car/:plate', async (req, res) => {
    const plate = req.params.plate;
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&filters={"mispar_rechev":"${plate}"}`;

    try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        
        if (response.data && response.data.result.records.length > 0) {
            const car = response.data.result.records[0];
            const brand = car.tozeret_nm.trim();
            const model = car.kinuy_mishari.trim();
            const year = car.shnat_yitzur;

            // הפעלת ה-AI לחיפוש תקלות נפוצות
            const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `אתה מומחה רכב. רשום ב-3 נקודות קצרות מאוד תקלות נפוצות לרכב: ${brand} דגם ${model} שנת ${year}. רק התקלות בעברית.`;
            
            const result = await aiModel.generateContent(prompt);
            const aiText = result.response.text();

            res.json({
                carData: car,
                aiAnalysis: aiText
            });
        } else {
            res.status(404).json({ error: "רכב לא נמצא" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "שגיאה בחיבור" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
