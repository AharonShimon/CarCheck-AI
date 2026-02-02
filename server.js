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

// --- כלי דיאגנוסטיקה: בדיקת המפתח והמודלים ---
app.get('/test-key', async (req, res) => {
    if (!API_KEY) {
        return res.json({ status: "ERROR", message: "No API Key found in environment" });
    }

    try {
        // שואלים את גוגל: איזה מודלים פתוחים למפתח הזה?
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(url);
        
        // מסננים רק את המודלים שיודעים לייצר טקסט (generateContent)
        const availableModels = response.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name); // מקבלים רשימה כמו ["models/gemini-pro", ...]

        res.json({
            status: "SUCCESS",
            message: "החיבור לגוגל תקין!",
            key_starts_with: API_KEY.substring(0, 5) + "...",
            available_models: availableModels
        });

    } catch (error) {
        console.error("Test Failed:", error.response ? error.response.data : error.message);
        res.json({
            status: "FAILED",
            error_code: error.response ? error.response.status : "Unknown",
            error_message: error.response ? JSON.stringify(error.response.data) : error.message
        });
    }
});

// --- נתיב ה-AI המתוקן (משתמש במודל הראשון שנמצא ברשימה) ---
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;

    try {
        // 1. קודם נבדוק איזה מודל קיים באמת
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const listResponse = await axios.get(listUrl);
        
        // לוקחים את המודל הראשון שזמין (בדרך כלל gemini-1.5-flash או gemini-pro)
        const validModel = listResponse.data.models.find(m => m.name.includes("gemini"));
        
        if (!validModel) throw new Error("No Gemini models found for this key");

        const modelName = validModel.name.replace("models/", ""); // מנקים את השם
        console.log(`Using confirmed model: ${modelName}`);

        // 2. שולחים את הבקשה למודל שנמצא
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
        
        const prompt = `רכב: ${brand} ${model} שנת ${year}. תן סיכום אמינות ותקלות נפוצות בעברית.`;
        
        const aiResponse = await axios.post(generateUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const text = aiResponse.data.candidates[0].content.parts[0].text;
        res.json({ success: true, aiAnalysis: text });

    } catch (error) {
        console.error("AI Flow Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "AI_FAILED" });
    }
});

// --- נתיב משרד התחבורה ---
app.post('/get-car-details', async (req, res) => {
    // ... (אותו קוד כמו קודם) ...
    const { plate } = req.body;
    try {
        const govUrl = "https://data.gov.il/api/3/action/datastore_search";
        const response = await axios.get(govUrl, {
            params: {
                resource_id: "053ad243-5e8b-4334-8397-47883b740881",
                filters: JSON.stringify({ mispar_rechev: plate })
            },
            timeout: 5000
        });
        if (response.data.success && response.data.result.records.length > 0) {
            return res.json({ success: true, data: response.data.result.records[0] });
        }
        return res.json({ success: false, error: "NOT_FOUND" });
    } catch (err) {
        return res.json({ success: false, error: "API_ERROR" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on port ${PORT}`));
