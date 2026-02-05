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
if (!API_KEY) console.error("❌ CRITICAL: Missing API Key");
else console.log("✅ Server started. Strategy: Multi-Model Cascade (2.5 -> 2.0 -> Lite).");

// === רשימת המודלים (נלקחה מה-JSON שלך) ===
// הסרתי את הקידומת 'models/' כי ה-URL מוסיף אותה לבד
const MODELS = [
    "gemini-2.5-flash",       // 🥇 העדיפות הראשונה: הכי חכם
    "gemini-2.0-flash",       // 🥈 גיבוי מהיר מאוד
    "gemini-2.5-flash-lite"   // 🥉 גיבוי קליל (כמעט תמיד פנוי)
];

// === 🧠 גיבוי חכם (ללא אינטרנט) ===
// פועל רק אם כל 3 המודלים של גוגל קרסו
function generateSmartBackup(brand, model, year) {
    const b = brand.toLowerCase().trim();
    
    // רכב חשמלי
    if (["byd", "geely", "tesla", "mg", "zeekr", "xpeng", "aiways", "seres", "nio", "ora"].includes(b) || model.toLowerCase().includes("ev")) {
        return {
            reliability_score: 88,
            summary: `ניתוח גיבוי (חשמלי): ${brand} ${model} מציג אמינות טובה במערכת ההנעה החשמלית. מומלץ להתמקד בבדיקת בריאות הסוללה (SOH) ומערכות הטעינה.`,
            common_faults: ["שחיקת צמיגים מוגברת (משקל)", "באגים במערכת המולטימדיה", "שקע טעינה", "רעשי פלסטיקה/קרקושים"],
            pros: ["עלויות אחזקה נמוכות", "ביצועים ושקט", "אגרת רישוי זולה"],
            cons: ["ירידת ערך לא וודאית", "טווח ריאלי מול הצהרת יצרן"]
        };
    }
    // רכב אסיאתי (יפני/קוריאני)
    if (["toyota", "honda", "mazda", "subaru", "suzuki", "hyundai", "kia", "mitsubishi", "nissan", "isuzu"].includes(b)) {
        return {
            reliability_score: 92,
            summary: `ניתוח גיבוי (אסיאתי): דגם ${brand} ${model} נחשב למניה בטוחה בשוק הישראלי. אמינות מכאנית גבוהה וסחירות מצוינת.`,
            common_faults: ["קילופי צבע ולכה (נזקי שמש)", "שחיקת חומרים בתא הנוסעים", "ממיר קטליטי (בדגמים ותיקים)"],
            pros: ["שמירת ערך וסחירות", "מזגן חזק ואמין", "עלויות טיפול סבירות"],
            cons: ["בידוד רעשים בינוני", "צריכת דלק ממוצעת", "אבזור פשוט בדגמי הבסיס"]
        };
    }
    // רכב אירופאי
    if (["skoda", "seat", "volkswagen", "audi", "bmw", "mercedes", "peugeot", "citroen", "renault", "opel"].includes(b)) {
        return {
            reliability_score: 78,
            summary: `ניתוח גיבוי (אירופאי): ${brand} ${model} מציע חווית נהיגה, בטיחות ונוחות ברמה גבוהה, אך דורש תחזוקה קפדנית ובזמן.`,
            common_faults: ["מערכת קירור (משאבות מים/תרמוסטט)", "נזילות שמן קלות", "חיישנים ומערכת חשמל", "גיר רובוטי (מצמדים/מוח)"],
            pros: ["איכות נסיעה ונוחות", "ביצועי מנוע (טורבו)", "תחושת יוקרה"],
            cons: ["רגישות להזנחה", "ירידת ערך מהירה יחסית", "חלפים יקרים יותר"]
        };
    }
    // ברירת מחדל כללית
    return {
        reliability_score: 80,
        summary: `ניתוח מערכת (גיבוי): דגם ${brand} ${model} משנת ${year} נחשב לרכב סביר. מומלץ לבצע בדיקה מקיפה במוסך מורשה לפני הקנייה.`,
        common_faults: ["בלאי טבעי (גומיות/מתלים)", "מערכת בלמים", "מערכת חשמל בסיסית"],
        pros: ["זמינות בשוק", "חלפים נגישים"],
        cons: ["צריכת דלק", "בלאי פנימי"]
    };
}

// === המנוע: ניסיון מדורג (Cascade) ===
async function fetchWithCascade(payload) {
    // רצים על הרשימה לפי הסדר: 2.5 -> 2.0 -> Lite
    for (const model of MODELS) {
        try {
            console.log(`🔄 Trying Model: ${model}...`);
            // בניית ה-URL המדויקת לפי המסמך ששלחת
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // אם קיבלנו 429 (עומס) או 404 (מודל לא נמצא) או 503 (נפילה זמנית)
            if (response.status === 429 || response.status === 404 || response.status >= 500) {
                console.warn(`⚠️ Model ${model} failed (Status ${response.status}). Switching to next model...`);
                continue; // מדלג למודל הבא ברשימה
            }

            if (!response.ok) throw new Error(`Error ${response.status}`);

            // הצלחה! מחזירים את המידע
            const data = await response.json();
            console.log(`✅ Success with: ${model}`);
            return data;

        } catch (error) {
            console.error(`❌ Error with ${model}: ${error.message}`);
            // ממשיכים למודל הבא
        }
    }
    
    // אם הגענו לפה - כל המודלים נכשלו
    return null;
}

app.post('/analyze-ai', async (req, res) => {
    let { brand, model, submodel, year } = req.body;
    if (!submodel || submodel === "null") submodel = "";
    const fullCarName = `${brand} ${model} ${submodel} (${year})`.trim();

    console.log(`🚀 Starting Analysis for: ${fullCarName}`);

    // הכנת גיבוי למקרה חירום
    const smartBackup = generateSmartBackup(brand, model, year);

    const payload = {
        contents: [{ parts: [{ text: `Act as an expert Israeli vehicle inspector. Analyze: "${fullCarName}". Return strict JSON only (Hebrew): { "reliability_score": 85, "summary": "Short summary", "common_faults": ["Fault1", "Fault2"], "pros": ["Pro1"], "cons": ["Con1"] }` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    };

    // הפעלת המפל
    const data = await fetchWithCascade(payload);

    if (data) {
        // יש תשובה מאחד המודלים
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const clean = rawText.replace(/```json|```/g, '').trim();
        res.json({ success: true, aiAnalysis: JSON.parse(clean) });
    } else {
        // הכל נכשל - מפעילים את הגיבוי החכם
        console.log("🔥 All models failed. Serving Smart Backup.");
        res.json({ success: true, aiAnalysis: smartBackup });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
