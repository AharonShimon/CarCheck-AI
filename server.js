require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- הדבק את המפתח שלך כאן ---
const API_KEY = "AIzaSyD4OS_qtVQIfJXlbYZFHqE_71QMBkGZx3s"; 

// 1. נתיב הניתוח הרגיל (ננסה מודל סופר-בסיסי בינתיים)
app.post('/analyze-ai', async (req, res) => {
    try {
        // ננסה את 'gemini-pro' הרגיל, אולי הוא יעבוד
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Analyze car: " + req.body.brand }] }]
        });
        res.json({ success: true, aiAnalysis: response.data });
    } catch (error) {
        res.status(500).json({ error: error.message, details: error.response?.data });
    }
});

// 2. הנתיב הסודי: בודק איזה מודלים פתוחים לך
app.get('/scan', async (req, res) => {
    console.log("🔍 סורק מודלים זמינים...");
    try {
        // בקשת GET לרשימת המודלים
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(url);
        
        // סינון רק למודלים שמתאימים ליצירת תוכן (generateContent)
        const availableModels = response.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name); // שולף רק את השם (למשל: models/gemini-1.5-flash)

        console.log("✅ רשימת מודלים:", availableModels);
        
        // מציג את הרשימה בדפדפן בצורה יפה
        res.send(`
            <h1>✅ המודלים שפתוחים עבורך:</h1>
            <pre>${JSON.stringify(availableModels, null, 2)}</pre>
            <h3>תעתיק לי את השם הראשון שמופיע ברשימה!</h3>
        `);
    } catch (error) {
        console.error("❌ הסריקה נכשלה:", error.response?.data || error.message);
        res.send(`<h1>❌ שגיאה בסריקה:</h1><pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>`);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

