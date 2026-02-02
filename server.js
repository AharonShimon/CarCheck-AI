const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/car/:plate', async (req, res) => {
    const plate = req.params.plate;
    // URL מעודכן ופשוט יותר
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&q=${plate}`;

    try {
        const response = await axios.get(url);
        // המאגר הממשלתי לפעמים מחזיר 200 אבל עם הצלחה false, אנחנו נבדוק את זה
        res.json(response.data);
    } catch (error) {
        console.error("Error from API:", error.response ? error.response.status : error.message);
        res.status(500).json({ error: "API Error", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
