require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// 1. הגשת קבצים סטטיים
app.use(express.static(path.join(__dirname)));

// 2. נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. ה-API של ה-AI
const API_KEY = process.env.GEMINI_API_KEY;

app.post('/analyze-ai', async (req, res) => {
    console.log(`🚀 Route hit: /analyze-ai with body:`, req.body); // לוג ראשון
    
    if (!API_KEY) { 
        console.error("❌ API Key Missing");
        return res.status(500).json({ error: "No API Key" });
    }

    try {
        const { brand, model, year } = req.body;
        const prompt = `Analyze car: ${brand} ${model} ${year}. Return JSON only: {"reliability_score": 85, "summary": "Good car", "common_faults": ["Brakes"], "pros": ["Fuel"]}`;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
        
        let rawText = response.data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(rawText);
        
        res.json({ success: true, aiAnalysis: aiData });
    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 10000;

// --- המלשין: הדפסת כל הנתיבים בעלייה ---
app.listen(PORT, () => {
    console.log(`\n🚀 SERVER STARTED ON PORT ${PORT}`);
    console.log("📝 Registered Routes (Check if /analyze-ai is here):");
    
    app._router.stack.forEach(print.bind(null, []));

    function print(path, layer) {
        if (layer.route) {
            layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
        } else if (layer.name === 'router' && layer.handle.stack) {
            layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
        } else if (layer.method) {
            console.log(`   ➡  ${layer.method.toUpperCase()} /${path.concat(split(layer.route.path)).filter(Boolean).join('/')}`);
        }
    }
    
    function split(thing) {
        if (typeof thing === 'string') return thing.split('/');
        if (thing.fast_slash) return '';
        var match = thing.toString().replace('\\/?', '').replace('(?=\\/|$)', '').match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
        return match ? match[1].replace(/\\(.)/g, '$1').split('/') : '<complex:' + thing.toString() + '>'
    }
});
