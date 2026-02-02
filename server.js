const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/car/:plate', async (req, res) => {
    const plate = req.params.plate;
    
    // כתובת מאגר הרכב המעודכנת
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&filters={"mispar_rechev":"${plate}"}`;

    try {
        const response = await axios.get(url);
        
        // בדיקה אם חזרו תוצאות
        if (response.data && response.data.result.records.length > 0) {
            res.json(response.data);
        } else {
            res.status(404).json({ error: "רכב לא נמצא במאגר" });
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: "שגיאה בפנייה למאגר הממשלתי" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
