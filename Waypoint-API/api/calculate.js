const WaypointCalculator = require('../lib/calculator');
const { checkSecurity } = require('../lib/security');

module.exports = (req, res) => {
    // 1. 優先處理 CORS 預檢請求 (OPTIONS)
    if (req.method === 'OPTIONS') {
        checkSecurity(req, res);
        return res.status(200).end();
    }

    // 2. 安全性檢查 (CORS & Referer)
    if (!checkSecurity(req, res)) {
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { coordinates, settings } = req.body;

        if (!coordinates || !Array.isArray(coordinates)) {
            res.status(400).json({ error: 'Invalid coordinates' });
            return;
        }

        const calculator = new WaypointCalculator();
        const waypoints = calculator.generateWaypoints(coordinates, settings || {});

        res.status(200).json({
            success: true,
            count: waypoints.length,
            waypoints: waypoints
        });

    } catch (error) {
        console.error('Calculation Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
