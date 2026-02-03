const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// פונקציית עזר להמתנה
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash"]; // 1.5 לרוב יציב יותר בחינמי
    
    let lastError = null;

    for (let modelName of modelsToTry) {
        let attempts = 0;
        while (attempts < 2) { // 2 נסיונות לכל מודל
            try {
                console.log(`Attempting with ${modelName} (Attempt ${attempts + 1})...`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
                
                const response = await axios.post(url, {
                    contents: [{ parts: [{ text: `נתח רכב: ${brand} ${model} ${year}. סיכום קצר בעברית: אמינות ותקלות.` }] }]
                }, { timeout: 10000 });

                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.json({ success: true, aiAnalysis: response.data.candidates[0].content.parts[0].text });
                }
            } catch (error) {
                lastError = error;
                if (error.response && error.response.status === 429) {
                    console.log("Got 429 - Cooling down for 2 seconds...");
                    await sleep(2000); // מחכה 2 שניות לפני ניסיון חוזר
                    attempts++;
                } else {
                    break; // שגיאה אחרת - עבור למודל הבא
                }
            }
        }
    }

    res.status(429).json({ success: false, error: "AI_OVERLOADED" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE and Protected against 429`));
