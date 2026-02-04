require('dotenv').config();
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
else console.log("✅ Server started. Using Gemini 2.0 Flash.");

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

        // טיפול בחסימת עומס (429)
        if (response.status === 429) {
            if (retries > 0) {
                console.log(`⏳ קיבלתי 429 (עומס). ממתין 5 שניות... (נשאר: ${retries})`);
                await sleep(5000); 
                return fetchWithRetry(url, payload, retries - 1);
            } else {
                console.error("❌ נגמרו ניסיונות ה-Retry.");
                return null; // מחזיר כלום כדי להפעיל את הגיבוי
            }
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Google Error ${response.status}: ${errText}`);
            return null;
        }

        return await response.json();

    } catch (error) {
        console.error("❌ Network Error:", error.message);
        return null;
    }
}

// === פונקציות ניקוי ===
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

// === נתיב 1: דגמים (Gemini 2.0 Flash) ===
app.post('/get-car-options', async (req, res) => {
    const { brand, model, year } = req.body;
    
    const cacheKey = `OPT_${brand}_${model}_${year}`;
    if (requestCache[cacheKey]) {
        return res.json({ success: true, options: requestCache[cacheKey] });
    }

    // שינוי ל-2.0-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: `List trim levels for "${brand} ${model}" in year ${year} in Israel. Return ONLY JSON array.` }] }],
        generationConfig: { temperature: 0.0 }
    };

    const data = await fetchWithRetry(url, payload);

    if (data) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const options = extractArray(rawText);
        if (options.length > 0) requestCache[cacheKey] = options;
        res.json({ success: true, options: options });
    } else {
        res.json({ success: false, options: [] });
    }
});

// === נתיב 2: ניתוח (Gemini 2.0 Flash) ===
app.post('/analyze-ai', async (req, res) => {
    const { brand, model, year } = req.body;
    console.log(`🚀 Analyzing: ${brand} ${model} (${year})`);
    
    const cacheKey = `ANL_${brand}_${model}_${year}`;
    if (requestCache[cacheKey]) {
        return res.json({ success: true, aiAnalysis: requestCache[cacheKey] });
    }

    // שינוי ל-2.0-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: `Act as an Israeli vehicle inspector. Analyze: "${brand} ${model} year ${year}". Output strict JSON: { "reliability_score": int, "summary": string, "common_faults": [], "pros": [], "cons": [] }` }] }],
        generationConfig: { temperature: 0.0, responseMimeType: "application/json" }
    };

    const data = await fetchWithRetry(url, payload);

    if (data) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const analysis = extractJSON(rawText);
        if (analysis && analysis.reliability_score) {
            requestCache[cacheKey] = analysis;
            return res.json({ success: true, aiAnalysis: analysis });
        }
    }

    // === מנגנון חירום (אם הכל נכשל) ===
    console.warn("⚠️ AI Failed. Sending Backup Data.");
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
