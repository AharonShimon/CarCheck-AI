const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// אתחול ה-AI (ודא שיש לך GEMINI_API_KEY ב-Render)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/analyze-car', async (req, res) => {
    let { plate, brand, model, year } = req.body;
    let govStatus = "SKIPPED"; // ברירת מחדל: לא בוצע חיפוש ממשלתי

    try {
        // --- שלב 1: בדיקת משרד התחבורה (אם הוזנה לוחית) ---
        if (plate && plate.length >= 7) {
            console.log(`Searching Gov DB for: ${plate}`);
            try {
                const govUrl = "https://data.gov.il/api/3/action/datastore_search";
                const response = await axios.get(govUrl, {
                    params: {
                        resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                        filters: JSON.stringify({ mispar_rechev: plate.toString().trim() })
                    },
                    timeout: 6000 // מחכה לממשלה עד 6 שניות
                });

                if (response.data.success) {
                    if (response.data.result.records.length > 0) {
                        // נמצא רכב! דורסים את המשתנים בנתונים המדויקים
                        const car = response.data.result.records[0];
                        brand = car.tozeret_nm.trim();
                        model = car.kinuy_mishari.trim();
                        year = car.shnat_yitzur;
                        govStatus = "SUCCESS";
                    } else {
                        govStatus = "NOT_FOUND"; // החיבור הצליח, המספר לא קיים
                    }
                }
            } catch (err) {
                console.log("Gov API Error:", err.message);
                // אבחנה בין נפילת שרת לבין סתם שגיאה
                if (err.code === 'ECONNABORTED') govStatus = "TIMEOUT";
                else govStatus = "API_ERROR";
            }
        }

        // --- שלב 2: בדיקת תקינות לפני AI ---
        // אם בסוף שלב 1 אין לנו יצרן ודגם (לא מהמשתמש ולא מהממשלה) -> מחזירים שגיאה ללקוח
        if (!brand || !model) {
            return res.json({ 
                success: false,
                error: "MISSING_DETAILS", 
                govStatus: govStatus 
            });
        }

        // --- שלב 3: הפעלת Gemini AI ---
        const aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `אתה מומחה רכב. נתח את האמינות של: ${brand} ${model} שנת ${year}.
        1. תן ציון אמינות (1-5 כוכבים).
        2. פרט 3 תקלות נפוצות בישראל ("מחלות ילדות").
        3. כתוב קצר, מקצועי ובעברית בלבד.`;

        const result = await aiModel.generateContent(prompt);
        const aiText = result.response.text();

        // החזרת תשובה מלאה
        res.json({
            success: true,
            govStatus: govStatus,
            aiAnalysis: aiText,
            detectedInfo: { brand, model, year }
        });

    } catch (error) {
        console.error("Critical Server Error:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
