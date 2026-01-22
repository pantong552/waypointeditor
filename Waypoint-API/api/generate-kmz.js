const KMZGenerator = require('../lib/kmz-generator');
const { checkSecurity } = require('../lib/security');

export default async function handler(req, res) {
    // 1. 優先處理 CORS 預檢請求 (OPTIONS)
    // 瀏覽器在發送 POST 前會先發送 OPTIONS 詢問權限
    if (req.method === 'OPTIONS') {
        // 呼叫 checkSecurity 以設定必要的 Access-Control-Allow-* Header
        checkSecurity(req, res);
        return res.status(200).end();
    }

    // 2. 安全性檢查：阻擋非法網域或未經授權的請求
    if (!checkSecurity(req, res)) {
        // 如果 checkSecurity 回傳 false，它內部已經處理了 res.status(403)
        return;
    }

    // 3. 限制請求方法：現在才檢查是否為 POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: "Method not allowed",
            message: "請透過官方網頁提交航點數據。"
        });
    }

    try {
        // 4. 獲取並驗證 Body 數據
        const { missionName, waypoints, settings = {} } = req.body;

        if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
            return res.status(400).json({ error: "無效的數據：請提供航點列表 (waypoints)。" });
        }

        // 5. 初始化生成器並產生 KMZ
        const generator = new KMZGenerator();
        const kmzBuffer = await generator.generateDJIKMZ(missionName, waypoints, settings);

        // 6. 設定 Response Headers
        res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
        const safeFileName = encodeURIComponent(missionName || 'mission');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.kmz"`);

        return res.send(kmzBuffer);

    } catch (error) {
        console.error('KMZ Generation Error:', error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "生成 KMZ 檔案時發生未知錯誤。"
        });
    }
}