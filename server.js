require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// הגדרות אבטחה וגישה
app.use(cors());
app.use(express.json());

// 1. הגשת קבצים סטטיים (ה-HTML והעיצוב)
app.use(express.static(path.join(__dirname)));

// 2. נתיב ראשי - מגיש את האתר
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. ה-API של ה-AI
const API_KEY = process.env.GEMINI_API_KEY;

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 בקשה התקבלה: ${JSON.stringify(req.body)}`); // לוג פשוט ובטוח
    
    if (!API_KEY) { 
        console.error("❌ שגיאה: חסר מפתח API");
        return res.status(500).json({ error: "No API Key configured on server" });
    }

    try {
        const { brand, model, year } = req.body;
        
        // הנחיה ל-AI
        const prompt = `
        Act as an expert car mechanic in Israel.
        Analyze: "${brand} ${model} year ${year}".
        
        Return JSON only (no markdown):
        {
            "reliability_score": (Integer 0-100),
            "summary": (Hebrew summary, max 15 words),
            "common_faults": (Array of 3 Hebrew faults),
            "pros": (Array of 2 Hebrew pros)
        }
        `;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        // ניקוי התשובה מסימנים מיותרים
        let rawText = response.data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json|```/g, '').trim();
        
        const aiData = JSON.parse(rawText);
        
        console.log("✅ תשובה נשלחה בהצלחה לדפדפן");
        res.json({ success: true, aiAnalysis: aiData });

    } catch (error) {
        console.error("❌ שגיאת AI:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// בדיקת דופק פשוטה
app.get('/test', (req, res) => {
    res.send("✅ Server is UP and AI route is ready at /analyze-ai");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`\n🚀 SERVER STARTED SUCCESSFULLY ON PORT ${PORT}`);
    console.log(`🌐 Ready to accept requests at /analyze-ai`);
});
