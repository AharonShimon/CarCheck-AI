const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// בדיקה שהמפתח קיים
console.log("Checking API Key:", process.env.GEMINI_API_KEY ? "EXISTS ✅" : "MISSING ❌");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/analyze-car', async (req, res) => {
    console.log("1. Request received!", req.body); // בדיקה שהבקשה הגיעה
    let { plate, brand, model, year } = req.body;

    try {
        // --- בדיקת משרד התחבורה ---
        if (plate && plate.length >= 7) {
            console.log("2. Starting Gov API check for plate:", plate);
            try {
                const govUrl = "https://data.gov.il/api/3/action/datastore_search";
                const response = await axios.get(govUrl, {
                    params: {
                        resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                        filters: JSON.stringify({ mispar_rechev: plate.toString().trim() })
                    },
                    timeout: 4000 // טיימאאוט קצר
                });

                if (response.data.success && response.data.result.records.length > 0) {
                    console.log("3. Gov API found car!");
                    const car = response.data.result.records[0];
                    brand = car.tozeret_nm.trim();
                    model = car.kinuy_mishari.trim();
                    year = car.shnat_yitzur;
                } else {
                    console.log("3. Gov API returned no records.");
                }
            } catch (err) {
                console.log("3. Gov API FAILED (Common in cloud servers):", err.message);
            }
        }

        // --- בדיקה לפני AI ---
        console.log("4. Data for AI:", { brand, model, year });
        
        if (!brand || !model) {
            console.log("ERROR: Missing brand/model, stopping.");
            return res.status(400).json({ error: "לא זוהה רכב. נא להקליד יצרן ודגם ידנית." });
        }

        // --- בדיקת AI ---
        console.log("5. Calling Gemini AI...");
        const aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `נתח בקצרה אמינות לרכב: ${brand} ${model} שנת ${year}. תן ציון כוכבים ו-3 תקלות נפוצות.`;
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("6. AI Responded success!");
        
        res.json({
            aiAnalysis: text,
            detectedInfo: { brand, model, year }
        });

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: "שגיאה פנימית בשרת: " + error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Debug Server running on port ${PORT}`));
