    console.log(`🔍 בקשת מפרט: ${brand} ${model} ${year}`);

    // 1. בדיקת זיכרון
    if (SPECS_DB[cacheKey]) {
        console.log("⚡ נשלף מהזיכרון");
        return res.json({ success: true, data: SPECS_DB[cacheKey] });
    }

    try {
        if (!API_KEY) throw new Error("חסר מפתח API בשרת");

        const prompt = `
        You are an expert Israeli car database.
        List ONLY the specific engine options (volume + type) and trim levels (רמות גימור) 
        that were officially sold in Israel for the following car:
        
        Manufacturer: ${brand}
        Model: ${model}
        Year: ${year}
        
        Rules:
        1. Focus ONLY on the Israeli market.
        2. Engines must include volume (e.g., "2.0L SkyActiv", "1.6L Turbo").
        3. Trims must be in English or Hebrew transliteration (e.g., "Executive", "Premium").
        4. Return valid JSON only: {"engines": ["..."], "trims": ["..."]}
        `;

        // קריאה לפונקציה החכמה
        const aiText = await callAIWithFallback(prompt);
        const specs = extractJSON(aiText);

        if (!specs) throw new Error("לא הצלחתי לפענח את ה-JSON");

        // שמירה בזיכרון
        SPECS_DB[cacheKey] = specs;
        res.json({ success: true, data: specs });

    } catch (error) {
        console.error("❌ כשל קריטי (כל המודלים נכשלו):", error.message);
        
        // רשת ביטחון אחרונה: רשימה גנרית כדי שהאפליקציה תעבוד
        res.json({ 
            success: true, 
            data: { 
                engines: ["בנזין", "טורבו", "היברידי", "דיזל", "חשמלי"], 
                trims: ["Basic", "Premium", "Luxury", "Sport", "אחר"] 
            },
            is_fallback: true
        });
    }
});

// === נתיב 2: ניתוח הרכב (מוסכניק) ===
app.post('/analyze-ai', async (req, res) => {
    try {
        const { brand, model, year, engine, trim, faults } = req.body;
        
        const prompt = `
        פעל כשמאי רכב ומוסכניק ישראלי.
        רכב: ${brand} ${model} שנת ${year} (${engine}), גימור: ${trim}.
        תקלות שדווחו: ${faults && faults.length ? faults.join(',') : "רכב נקי"}.
        
        החזר JSON בלבד:
        {
            "reliability_score": מספר (1-100),
            "summary": "סיכום קצר וחד בעברית",
            "common_faults": ["תקלה 1 (X שח)", "תקלה 2 (Y שח)"],
            "negotiation_tip": "טיפ למומ"
        }`;

        const aiText = await callAIWithFallback(prompt);
        const result = extractJSON(aiText);

        if (!result) throw new Error("Invalid JSON from Analysis");

        res.json({ success: true, aiAnalysis: result });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

