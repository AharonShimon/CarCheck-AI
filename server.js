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

// פונקציית השהייה חכמה
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === המנוע החכם: Exponential Backoff ===
async function fetchWithBackoff(url, payload, attempt = 1, maxRetries = 3) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // הצלחה
        if (response.ok) return await response.json();

        // אם השגיאה היא 429 (עומס) ויש לנו עוד ניסיונות
        if (response.status === 429 && attempt <= maxRetries) {
            // הנוסחה: 2 בחזקת מס' הניסיון * 1000. 
            // ניסיון 1 = 2 שניות. ניסיון 2 = 4 שניות. ניסיון 3 = 8 שניות.
            const delay = Math.pow(2, attempt) * 1000;
            
            console.warn(`⏳ עומס (429). מנסה שוב בעוד ${delay/1000} שניות... (ניסיון ${attempt}/${maxRetries})`);
            
            await wait(delay);
            return fetchWithBackoff(url, payload, attempt + 1, maxRetries);
        }

        // שגיאה אחרת או שנגמרו הניסיונות
        throw new Error(`Google Error ${response.status}`);

    } catch (error) {
        // אם הגענו לכאן ועדיין יש ניסיונות (למשל שגיאת רשת)
        if (attempt <= maxRetries) {
             const delay = Math.pow(2, attempt) * 1000;
             console.log(`⚠️ שגיאת רשת. מנסה שוב...`);
             await wait(delay);
             return fetchWithBackoff(url, payload, attempt + 1, maxRetries);
        }
        throw error;
    }
}

app.post('/analyze-ai', async (req, res) => {
    let { brand, model, submodel, year } = req.body;
    if (!submodel || submodel === "null") submodel = "";
    const fullCarName = `${brand} ${model} ${submodel} (${year})`.trim();

    console.log(`🚀 Start Analysis: ${fullCarName}`);

    const backupData = {
        reliability_score: 80,
        summary: "ניתוח מערכת (גיבוי): הרכב נחשב אמין יחסית, אך מומלץ לבדוק היסטוריית טיפולים עקב עומס זמני בשרתי הניתוח.",
        common_faults: ["בלאי טבעי", "מערכת קירור", "פלסטיקה"],
        pros: ["סחירות טובה", "חלפים זמינים"],
        cons: ["צריכת דלק", "בידוד רעשים"]
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const payload = {
            contents: [{ parts: [{ text: `Analyze car for Israeli market: "${fullCarName}". Return JSON: {reliability_score: int, summary: string, common_faults: [], pros: [], cons: []} Hebrew only.` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        };

        // שימוש בפונקציה החכמה
        const data = await fetchWithBackoff(url, payload);
        
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const clean = rawText.replace(/```json|```/g, '').trim();
        
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });

    } catch (error) {
        console.error("❌ Final Failure:", error.message);
        // רק אם הכל נכשל אחרי כל הניסיונות - מחזירים גיבוי
        res.json({ success: true, aiAnalysis: backupData });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
