const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json()); // מאפשר לשרת לקרוא את הנתונים שנשלחים מה-HTML

// חיבור ל-AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze-car', async (req, res) => {
    const { plate, brand, model, year } = req.body;
    
    let finalBrand = brand;
    let finalModel = model;
    let finalYear = year;
    let govData = null;

    try {
        // 1. חיפוש במאגר הממשלתי אם יש מספר רכב
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

        // 2. בדיקה שיש לנו מספיק מידע ל-AI
        if (!finalBrand) {
            return res.status(400).json({ error: "נא להזין מספר רכב או פרטי יצרן ודגם" });
        }

        // 3. פנייה ל-Gemini AI לניתוח תקלות נפוצות
        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `אתה מומחה רכב ישראלי. נתח את הרכב הבא: ${finalBrand} ${finalModel} שנת ${finalYear}. 
        רשום ב-4 נקודות קצרות ובולטות (בולטים/Bullet points) מהן התקלות המכניות והחשמליות הנפוצות ביותר לדגם ולשנה זו. רשום רק בעברית.`;
        
        const result = await aiModel.generateContent(prompt);
        const aiText = result.response.text();

        // 4. החזרת התשובה המשולבת לאתר
        res.json({
            govData: govData,
            aiAnalysis: aiText,
            detectedInfo: { brand: finalBrand, model: finalModel, year: finalYear }
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "שגיאה בתהליך הניתוח" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
