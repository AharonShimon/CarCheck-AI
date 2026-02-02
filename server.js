const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

// השרת יקשיב לנתיב /car/ ואז מספר הלוחית
app.get('/car/:plate', async (req, res) => {
    const plate = req.params.plate;
    // כתובת המאגר הממשלתי
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053ad243-5e8b-4334-8397-47883b740881&filters={"mispar_rechev":"${plate}"}`;

    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
