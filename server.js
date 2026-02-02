const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json()); // קריטי לקבלת נתונים מהאתר

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze-car', async (req, res) => {
    const { plate, brand, model, year } = req.body;
    
    let finalBrand = brand;
    let finalModel = model;
    let finalYear = year;
    let govData = null;

    try {
        // שלב 1: אם יש לוחית, מושכים נתונים מ-GOV.IL
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

        // שלב 2: אם אין מספיק נתונים גם אחרי GOV וגם ידני
        if (!finalBrand) {
            return res.status(400).json({ error: "נא להזין מספר רכב או פרטי יצרן ודגם" });
        }

        // שלב 3: פנייה ל-AI (Gemini) לקבלת תקלות נפוצות
        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `אתה מומחה רכב ישראלי. רשום ב-3 נקודות קצרות ובולטות תקלות נפוצות לרכב: ${finalBrand} דגם ${finalModel} משנת ${finalYear}. רשום רק את התקלות בעברית.`;
        
        const result = await aiModel.generateContent(prompt);
        const aiText = result.response.text();

        // מחזירים הכל לאתר
        res.json({
            govData: govData,
            aiAnalysis: aiText,
            detectedInfo: { brand: finalBrand, model: finalModel, year: finalYear }
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "שגיאה בתהליך הניתוח" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
