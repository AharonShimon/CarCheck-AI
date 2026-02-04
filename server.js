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

const API_KEY = process.env.GEMINI_API_KEY; 

// require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.GEMINI_API_KEY; 

// === 1. Cache: זיכרון למניעת בקשות מיותרות ===
const requestCache = {};

if (!API_KEY) console.error("❌ CRITICAL: Missing API Key");
else console.log("✅ Server started. Using Gemini 1.5 Flash (Stable Mode).");

// === 2. פונקציית המתנה (Sleep) ===
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === 3. המנוע העקשן (Smart Retry) ===
async function fetchWithRetry(url, payload, retries = 3) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 429) {
            if (retries > 0) {
                console.log(`⏳ קיבלתי 429 (עומס). ממתין 10 שניות... (נשאר: ${retries})`);
                await sleep(10000); // חיקוי המתנה נדיב
                return fetchWithRetry(url, payload, retries - 1);
            } else {
                // אם נגמרו הניסיונות, נחזיר null כדי שהקוד ידע להשתמש בגיבוי
                console.error("❌ נגמרו ניסיונות ה-Retry.");
                return null; 
            }
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google Error ${response.status}: ${errText}`);
        }

        return await response.json();

    } catch (error) {
        console.error("❌ Network Error:", error.message);
        return null;
    }
}

// === פונקציית ניקוי ===
function extractJSON(text) {
    try {
        if (!text) return null;
        let clean = text.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
        return JSON.parse(clean);
    } catch (e) { return null; }
}

function extractArray(text) {
    try {
        if (!text) return [];
        let clean = text.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
        if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
        return JSON.parse(clean);
    } catch (e) { return []; }
}

// === נתיב 1: דגמים (1.5 Flash + Cache + Retry) ===
app.post('/get-car-options', async (req, res) => {
    const { brand, model, year } = req.body;
    
    // בדיקה בזיכרון
    const cacheKey = `OPT_${brand}_${model}_${year}`;
    if (requestCache[cacheKey]) {
        console.log(`⚡ מהזיכרון: ${brand} ${model}`);
        return res.json({ success: true, options: requestCache[cacheKey] });
    }

    // שימוש ב-1.5 במקום 2.5
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: `List trim levels for "${brand} ${model}" in year ${year} in Israel. Return ONLY JSON array.` }] }],
        generationConfig: { temperature: 0.0 }
    };

    const data = await fetchWithRetry(url, payload);

    if (data) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = extractArray(rawText);
        if (options.length > 0) requestCache[cacheKey] = options; // שומר בזיכרון
        res.json({ success: true, options: options });
    } else {
        // במקרה של כישלון סופי, מחזיר רשימה ריקה לא קורס
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח (1.5 Flash + Backup Data) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    // בדיקה בזיכרון
    const cacheKey = `ANL_${brand}_${model}_${year}`;
    if (requestCache[cacheKey]) {
        return res.json({ success: true, aiAnalysis: requestCache[cacheKey] });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: `Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}". Output strict JSON: { "reliability_score": int, "summary": string, "common_faults": [], "pros": [], "cons": [] }` }] }],
        generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
    };

    const data = await fetchWithRetry(url, payload);

    if (data) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = extractJSON(rawText);
        if (analysis && analysis.reliability_score) {
            requestCache[cacheKey] = analysis; // שומר בזיכרון
            return res.json({ success: true, aiAnalysis: analysis });
        }
    }

    // === מנגנון חירום (אם ה-AI נכשל סופית) ===
    console.warn("⚠️ AI Failed or Limit Reached. Sending Backup Data.");
    const backupData = {
        reliability_score: 80,
        summary: "המערכת בעומס רגעי. זהו ניתוח כללי: הרכב נחשב אמין יחסית לשנתון, אך דורש בדיקה קפדנית של היסטוריית הטיפולים.",
        common_faults: ["בלאי טבעי", "מערכת קירור", "חיישנים"],
        pros: ["סחירות טובה", "חלפים זמינים"],
        cons: ["צריכת דלק", "פלסטיקה מתבלה"]
    };
    res.json({ success: true, aiAnalysis: backupData });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
else console.log("✅ Server started. Key loaded.");

// === פונקציית ניקוי חכמה ===
function cleanAndParseJSON(text) {
    try {
        // מנקה Markdown ורווחים
        let clean = text.replace(/```json|```/g, '').trim();
        
        // מוצא את האובייקט JSON הראשון והאחרון
        const startObj = clean.indexOf('{');
        const endObj = clean.lastIndexOf('}');
        
        if (startObj !== -1 && endObj !== -1) {
            clean = clean.substring(startObj, endObj + 1);
        }
        
        return JSON.parse(clean);
    } catch (e) {
        console.error("⚠️ Failed to parse JSON:", text);
        return null; // מחזיר NULL במקרה כישלון
    }
}

function cleanAndParseArray(text) {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const startArr = clean.indexOf('[');
        const endArr = clean.lastIndexOf(']');
        
        if (startArr !== -1 && endArr !== -1) {
            clean = clean.substring(startArr, endArr + 1);
        }
        return JSON.parse(clean);
    } catch (e) {
        return [];
    }
}

// === נתיב 1: דגמים ===
app.post('/get-car-options', async (req, res) => {
    try {
        const { brand, model } = req.body;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const prompt = `List all trim levels for "${brand} ${model}" in Israel. Return ONLY JSON array. Example: ["1.6 Sun", "1.8 Hybrid"]`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0 }
        });

        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = cleanAndParseArray(rawText);
        
        res.json({ success: true, options: options });

    } catch (error) {
        console.error("Error fetching options:", error.message);
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח (התיקון הקריטי) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const smartPrompt = `
        Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}".
        Output JSON ONLY:
        {
            "reliability_score": 85, 
            "summary": "Hebrew summary here", 
            "common_faults": ["Fault 1", "Fault 2"], 
            "pros": ["Pro 1"],
            "cons": ["Con 1"]
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: smartPrompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
        });
        
        const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = cleanAndParseJSON(rawText);

        // === ההגנה מפני קריסה ===
        if (!analysis || !analysis.reliability_score) {
            console.error("❌ AI returned invalid data");
            return res.json({ success: false, error: "AI Parsing Failed" });
        }

        res.json({ success: true, aiAnalysis: analysis });

    } catch (error) {
        console.error("❌ AI Error:", error.message);
        res.status(500).json({ error: "Connection Error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

