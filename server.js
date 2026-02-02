const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// אתחול ה-AI עם המפתח מהגדרות השרת
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/analyze-car', async (req, res) => {
    let { plate, brand, model, year } = req.body;

    try {
        // 1. ניסיון משיכת נתונים ממשרד התחבורה
        if (plate && plate.length >= 7 && (!brand || brand === "")) {
            try {
                const govUrl = "https://data.gov.il/api/3/action/datastore_search";
                const response = await axios.get(govUrl, {
                    params: {
                        resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                        filters: JSON.stringify({ mispar_rechev: plate.toString().trim() })
                    },
                    timeout: 5000 // מחכה מקסימום 5 שניות לממשלה
                });

                if (response.data.success && response.data.result.records.length > 0) {
                    const car = response.data.result.records[0];
                    brand = car.tozeret_nm.trim();
                    model = car.kinuy_mishari.trim();
                    year = car.shnat_yitzur;
                }
            } catch (err) {
                console.log("Gov API logic skipped or failed:", err.message);
                // ממשיכים הלאה, אולי המשתמש הקליד ידנית
            }
        }

        // 2. בדיקה שיש לנו מספיק מידע ל-AI
        if (!brand || brand === "") {
            return res.status(400).json({ error: "לא נמצאו פרטי רכב. נא להזין דגם ידנית." });
        }

        // 3. הפעלת ה-AI (שימוש במודל היציב ביותר)
        const modelAI = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `נתח את האמינות של הרכב הבא: ${brand} ${model} שנת ${year}. 
        כתוב בעברית:
        1. ציון אמינות (1-5 כוכבים).
        2. שלוש תקלות נפוצות המוכרות במוסכים בישראל.
        היה קצר וענייני.`;

        const result = await modelAI.generateContent(prompt);
        const responseAI = await result.response;
        const text = responseAI.text();

        // 4. החזרת תשובה מסודרת לאתר
        res.json({
            aiAnalysis: text,
            detectedInfo: { brand, model, year }
        });

    } catch (error) {
        console.error("Critical Server Error:", error);
        res.status(500).json({ error: "שגיאה בתהליך הניתוח. ודא שמפתח ה-API תקין." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running perfectly on port ${PORT}`);
});
