const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CONFIG
========================= */
const PORT = process.env.PORT || 10000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* =========================
   STATIC FRONTEND
========================= */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/* =========================
   HELPERS
========================= */
const isValidPlate = (plate) =>
    typeof plate === 'string' && /^[0-9]{7,8}$/.test(plate);

const fetchGovData = async (plate) => {
    const govUrl = `https://data.gov.il/api/3/action/datastore_search`;
    const response = await axios.get(govUrl, {
        timeout: 4000,
        params: {
            resource_id: "053ad243-5e8b-4334-8397-47883b740881",
            filters: JSON.stringify({ mispar_rechev: plate })
        }
    });

    return response.data?.result?.records?.[0] || null;
};

const analyzeWithAI = async ({ brand, model, year }) => {
    const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
אתה מומחה רכב ישראלי.
נתח את הרכב הבא והחזר JSON בלבד:

{
 "rating": מספר בין 1 ל-5,
 "issues": [ "בעיה 1", "בעיה 2", "בעיה 3" ],
 "summary": "סיכום קצר"
}

רכב:
יצרן: ${brand}
דגם: ${model}
שנה: ${year}
`;

    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    return JSON.parse(text);
};

/* =========================
   API – ANALYZE CAR
========================= */
app.post('/analyze-car', async (req, res) => {
    try {
        const { plate, brand, model, year } = req.body;

        let finalBrand = brand;
        let finalModel = model;
        let finalYear = year;
        let govData = null;

        // GOV lookup
        if (isValidPlate(plate)) {
            govData = await fetchGovData(plate);
            if (govData) {
                finalBrand = govData.tozeret_nm?.trim();
                finalModel = govData.kinuy_mishari?.trim();
                finalYear = govData.shnat_yitzur;
            }
        }

        // Validation
        if (!finalBrand || !finalModel || !finalYear) {
            return res.status(400).json({
                error: "חסרים פרטי רכב לניתוח"
            });
        }

        // AI Analysis
        const aiResult = await analyzeWithAI({
            brand: finalBrand,
            model: finalModel,
            year: finalYear
        });

        return res.json({
            vehicle: {
                plate,
                brand: finalBrand,
                model: finalModel,
                year: finalYear
            },
            govData,
            aiAnalysis: aiResult
        });

    } catch (error) {
        console.error("Analyze Error:", error.message);

        return res.status(500).json({
            error: "שגיאה בניתוח הרכב",
            details: error.message
        });
    }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
    console.log(`🚗 CarCheck AI Pro running on port ${PORT}`);
});
