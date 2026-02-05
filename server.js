require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.GEMINI_API_KEY;

// אתחול המנוע
const genAI = new GoogleGenerativeAI(API_KEY);
// שימוש במודל flash היציב
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        return null;
    }
}

// נתיב 1: מפרטים
app.post('/get-specs', async (req, res) => {
    const { brand, model: carModel, year } = req.body;
    console.log(`🔍 מפרט: ${brand} ${carModel} ${year}`);

    try {
        if (!API_KEY) throw new Error("Missing API Key");

        const prompt = `
        List ONLY engine options (volume+type) and trims for ${year} ${brand} ${carModel} in Israel.
        JSON format: {"engines": ["..."], "trims": ["..."]}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const specs = extractJSON(text);
        if (!specs) throw new Error("Invalid JSON");

        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.json({ 
            success: true, 
            data: { engines: ["בנזין", "היברידי"], trims: ["Basic", "Premium"] },
            is_fallback: true
        });
    }
});

// נתיב 2: ניתוח
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model: carModel, year, engine, trim, faults } = req.body;
        
        const prompt = `
        שמאי רכב: ${brand} ${carModel} ${year} (${engine}), ${trim}.
        תקלות: ${faults?.join(',') || "אין"}.
        JSON: {"reliability_score": 80, "summary": "...", "common_faults": ["..."], "negotiation_tip": "..."}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonResult = extractJSON(text);
        res.json({ success: true, aiAnalysis: jsonResult });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
